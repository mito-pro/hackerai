import nodemailer from "nodemailer";
import { get, nowIso, run } from "./db";
import { generateOtpCode, hmac, safeEqual } from "./crypto";
import { getAppHost, getOtpMailSettings, normalizeAppHost } from "./settings";
import { buildOtpTemplate } from "./otp-template";
import { generateId } from "./utils";
import { adminEmailAllowlist } from "./admins";
import { getDefaultPlan } from "./plans";
import { monthStart } from "./usage";

export const CODE_TTL_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 45;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR_EMAIL = 5;
const MAX_PER_HOUR_IP = 30;
const DEFAULT_APP_HOST = "localhost.run";

export type OtpRequestResult = {
  ok: boolean;
  error?: string;
  code?: "invalid_email" | "cooldown" | "rate_limit";
  devCode?: string;
  expiresAt?: string;
  emailSent?: boolean;
  retryAfter?: number;
};

export function hashOtp(email: string, code: string) {
  return hmac(`${email.trim().toLowerCase()}:${code}`);
}

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export async function requestOtpCode(
  emailInput: string,
  ip?: string | null,
  requestHost?: string | null
): Promise<OtpRequestResult> {
  const email = emailInput.trim().toLowerCase();

  if (!isValidEmail(email)) {
    return {
      ok: false,
      error: "Informe um e-mail valido.",
      code: "invalid_email",
    };
  }

  const last = await get<{ created_at: string }>(
    "SELECT created_at FROM otp_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (last) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < RESEND_COOLDOWN_SECONDS * 1000) {
      const wait = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsed) / 1000);
      return {
        ok: false,
        error: `Aguarde ${wait}s para solicitar um novo codigo.`,
        code: "cooldown",
        retryAfter: wait,
      };
    }
  }

  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const emailRow = await get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM otp_codes WHERE email = ? AND created_at > ?",
    [email, oneHourAgo]
  );
  const emailCount = emailRow?.count ?? 0;
  if (emailCount >= MAX_PER_HOUR_EMAIL) {
    return {
      ok: false,
      error: "Limite de 5 codigos por hora para este e-mail.",
      code: "rate_limit",
    };
  }

  if (ip) {
    const ipRow = await get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM otp_codes WHERE ip = ? AND created_at > ?",
      [ip, oneHourAgo]
    );
    const ipCount = ipRow?.count ?? 0;
    if (ipCount >= MAX_PER_HOUR_IP) {
      return {
        ok: false,
        error: "Limite de requisicoes por IP atingido.",
        code: "rate_limit",
      };
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  const otpId = generateId("otp");

  await run(
    "UPDATE otp_codes SET consumed = 1 WHERE email = ? AND consumed = 0",
    [email]
  );

  await run(
    "INSERT INTO otp_codes (id, email, code_hash, expires_at, attempts, consumed, ip, created_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?)",
    [
      otpId,
      email,
      hashOtp(email, code),
      expiresAt,
      ip ?? null,
      nowIso(),
    ]
  );

  const appHost = await resolveAppHost(requestHost);
  const emailSent = await deliverCode(email, code, appHost);
  if (!emailSent) {
    // Sem SMTP (dev ou producao sem configuracao): o codigo permanece valido
    // (TTL + tentativas) e aparece nos logs do servidor para o operador usar.
    console.log(`[NEXUS] OTP para ${email}: ${code}`);
  }

  const devCode =
    !emailSent && process.env.NODE_ENV !== "production" ? code : undefined;

  return {
    ok: true,
    expiresAt,
    emailSent,
    devCode,
  };
}

export async function resolveAppHost(requestHost?: string | null) {
  return (await getAppHost()) || normalizeAppHost(requestHost) || DEFAULT_APP_HOST;
}

function createTransporter(
  settings: NonNullable<Awaited<ReturnType<typeof getOtpMailSettings>>>
) {
  if (!settings) throw new Error("SMTP nao configurado.");
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

async function deliverCode(email: string, code: string, appHost: string) {
  const settings = await getOtpMailSettings();
  if (!settings) return false;

  try {
    const transporter = createTransporter(settings);
    const template = buildOtpTemplate({
      code,
      ttlMinutes: CODE_TTL_MINUTES,
      appHost,
    });

    await transporter.sendMail({
      from: settings.from,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    return true;
  } catch (error) {
    console.error("[NEXUS] falha ao enviar OTP:", error);
    return false;
  }
}

export async function sendTestOtpEmail(to: string) {
  const settings = await getOtpMailSettings();
  if (!settings) throw new Error("SMTP nao configurado.");

  const code = generateOtpCode();
  const template = buildOtpTemplate({
    code,
    ttlMinutes: CODE_TTL_MINUTES,
    appHost: await resolveAppHost(),
  });

  const transporter = createTransporter(settings);
  const info = await transporter.sendMail({
    from: settings.from,
    to,
    subject: `[TESTE] ${template.subject}`,
    text: template.text,
    html: template.html,
  });

  return { code, messageId: info.messageId };
}

export type VerifyResult = {
  ok: boolean;
  error?: string;
  userId?: string;
};

export async function verifyOtpCode(
  emailInput: string,
  codeInput: string
): Promise<VerifyResult> {
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.trim();

  const record = await get<{
    id: string;
    code_hash: string;
    expires_at: string;
    attempts: number;
    consumed: number;
  }>(
    "SELECT id, code_hash, expires_at, attempts, consumed FROM otp_codes WHERE email = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1",
    [email]
  );

  if (!record) {
    return { ok: false, error: "Codigo invalido ou expirado." };
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Codigo expirado. Solicite um novo." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await run("UPDATE otp_codes SET consumed = 1 WHERE id = ?", [record.id]);
    return { ok: false, error: "Muitas tentativas. Solicite um novo codigo." };
  }

  if (!safeEqual(record.code_hash, hashOtp(email, code))) {
    await run("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [
      record.id,
    ]);
    const left = MAX_ATTEMPTS - record.attempts - 1;
    return {
      ok: false,
      error: `Codigo invalido. ${left} tentativa(s) restante(s).`,
    };
  }

  await run("UPDATE otp_codes SET consumed = 1 WHERE id = ?", [record.id]);
  const user = await ensureUser(email);
  return { ok: true, userId: user.id };
}

export async function ensureUser(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const allowlist = adminEmailAllowlist();
  const listed = allowlist.includes(email);
  const existing = await get<{ id: string; role: string }>(
    "SELECT id, role FROM users WHERE email = ?",
    [email]
  );
  if (existing) {
    let role = existing.role as "user" | "admin";
    // Allowlist apenas promove: quem ja e admin nunca e rebaixado.
    if (listed && role !== "admin") {
      role = "admin";
      await run("UPDATE users SET role = ? WHERE id = ?", [role, existing.id]);
    }
    await run("UPDATE users SET last_login_at = ? WHERE id = ?", [
      nowIso(),
      existing.id,
    ]);
    return { id: existing.id, role };
  }

  const plan = await getDefaultPlan();
  const countRow = await get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users"
  );
  const userCount = countRow?.count ?? 0;
  const role =
    allowlist.length > 0
      ? listed
        ? "admin"
        : "user"
      : userCount === 0
        ? "admin"
        : "user";
  const id = generateId("usr");
  const name = email.split("@")[0].replace(/[._-]+/g, " ");

  await run(
    "INSERT INTO users (id, email, name, role, plan_id, status, tokens_used, messages_today, period_start, day_start, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, 'active', 0, 0, ?, ?, ?, ?)",
    [
      id,
      email,
      name,
      role,
      plan.id,
      monthStart().toISOString(),
      new Date().toISOString(),
      nowIso(),
      nowIso(),
    ]
  );

  return { id, role };
}
