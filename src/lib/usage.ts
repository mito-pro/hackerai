import { get, nowIso, run, type UserRow } from "./db";
import { getPlan, hasCapability, type Plan } from "./plans";
import { generateId } from "./utils";

export const RATE_LIMIT_STANDARD = 5;
export const RATE_LIMIT_PRIORITY = 20;

export function rateLimitFor(plan: Plan) {
  return hasCapability(plan, "priority_queue")
    ? RATE_LIMIT_PRIORITY
    : RATE_LIMIT_STANDARD;
}

export function monthStart(date = new Date()) {
  const value = new Date(date);
  value.setUTCDate(1);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

export function dayStart(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

export function syncCounters(userId: string): UserRow | null {
  const user = get<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return null;

  const period = monthStart().toISOString();
  const day = dayStart().toISOString();

  if (user.period_start !== period) {
    run("UPDATE users SET tokens_used = 0, period_start = ? WHERE id = ?", [
      period,
      userId,
    ]);
  }
  if (user.day_start !== day) {
    run("UPDATE users SET messages_today = 0, day_start = ? WHERE id = ?", [
      day,
      userId,
    ]);
  }

  return get<UserRow>("SELECT * FROM users WHERE id = ?", [userId]) ?? null;
}

export function tokenQuota(user: UserRow, plan: Plan) {
  return user.token_override ?? plan.monthlyTokens;
}

export type QuotaCheck = {
  allowed: boolean;
  code?: string;
  message?: string;
  used: number;
  limit: number;
};

export function checkQuota(user: UserRow, plan: Plan): QuotaCheck {
  const limit = tokenQuota(user, plan);
  const used = user.tokens_used;

  if (user.messages_today >= plan.dailyMessages) {
    return {
      allowed: false,
      code: "daily_limit",
      message: `Limite diario de ${plan.dailyMessages} mensagens atingido. O contador reinicia a meia-noite UTC.`,
      used,
      limit,
    };
  }

  if (used >= limit) {
    return {
      allowed: false,
      code: "token_limit",
      message: `Cota de ${limit.toLocaleString("pt-BR")} tokens do plano ${plan.name} esgotada.`,
      used,
      limit,
    };
  }

  return { allowed: true, used, limit };
}

export function recordUsage(params: {
  userId: string;
  chatId?: string | null;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const total = params.inputTokens + params.outputTokens;
  run(
    "INSERT INTO usage_logs (id, user_id, chat_id, model, provider, input_tokens, output_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      generateId("use"),
      params.userId,
      params.chatId ?? null,
      params.model,
      params.provider,
      params.inputTokens,
      params.outputTokens,
      total,
      nowIso(),
    ]
  );
  run("UPDATE users SET tokens_used = tokens_used + ? WHERE id = ?", [
    total,
    params.userId,
  ]);
  return total;
}

export function incrementMessageCount(userId: string) {
  run("UPDATE users SET messages_today = messages_today + 1 WHERE id = ?", [
    userId,
  ]);
}

export type UsageSummary = {
  tokensUsed: number;
  tokenLimit: number;
  messagesToday: number;
  dailyLimit: number;
  percent: number;
};

export function usageSummary(user: UserRow, plan: Plan): UsageSummary {
  const limit = tokenQuota(user, plan);
  return {
    tokensUsed: user.tokens_used,
    tokenLimit: limit,
    messagesToday: user.messages_today,
    dailyLimit: plan.dailyMessages,
    percent: limit > 0 ? Math.min(100, (user.tokens_used / limit) * 100) : 0,
  };
}

export function planForUser(user: UserRow): Plan {
  return getPlan(user.plan_id) ?? getPlan("free")!;
}
