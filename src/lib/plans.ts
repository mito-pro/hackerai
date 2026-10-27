import { all, get, run, type PlanRow } from "./db";
import {
  hasCapability as capabilityEnabled,
  isPlanCapability,
  type PlanCapability,
} from "./capabilities";

export { PLAN_CAPABILITIES } from "./capabilities";
export type { PlanCapability } from "./capabilities";

export type Plan = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  monthlyTokens: number;
  dailyMessages: number;
  maxContext: number;
  features: string[];
  historyDays: number;
  capabilities: PlanCapability[];
  priority: number;
  isDefault: boolean;
};

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return [];
  }
  return [];
}

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    monthlyTokens: row.monthly_tokens,
    dailyMessages: row.daily_messages,
    maxContext: row.max_context,
    features: parseList(row.features),
    historyDays: row.history_days,
    capabilities: parseList(row.capabilities).filter(isPlanCapability),
    priority: row.priority,
    isDefault: row.is_default === 1,
  };
}

export function listPlans(): Plan[] {
  return all<PlanRow>(
    "SELECT * FROM plans ORDER BY priority ASC, price ASC"
  ).map(mapPlan);
}

export function getPlan(id: string): Plan | null {
  const row = get<PlanRow>("SELECT * FROM plans WHERE id = ?", [id]);
  return row ? mapPlan(row) : null;
}

export function getDefaultPlan(): Plan {
  const row =
    get<PlanRow>("SELECT * FROM plans WHERE is_default = 1 LIMIT 1") ||
    get<PlanRow>("SELECT * FROM plans ORDER BY priority ASC LIMIT 1");
  if (!row) throw new Error("Nenhum plano configurado");
  return mapPlan(row);
}

export function hasCapability(plan: Plan, capability: PlanCapability) {
  return capabilityEnabled(plan.capabilities, capability);
}

export function upsertPlan(plan: Plan) {
  run(
    `INSERT INTO plans (id, name, category, description, price, monthly_tokens, daily_messages, max_context, features, history_days, capabilities, priority, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       description = excluded.description,
       price = excluded.price,
       monthly_tokens = excluded.monthly_tokens,
       daily_messages = excluded.daily_messages,
       max_context = excluded.max_context,
       features = excluded.features,
       history_days = excluded.history_days,
       capabilities = excluded.capabilities,
       priority = excluded.priority,
       is_default = excluded.is_default`,
    [
      plan.id,
      plan.name,
      plan.category,
      plan.description,
      plan.price,
      plan.monthlyTokens,
      plan.dailyMessages,
      plan.maxContext,
      JSON.stringify(plan.features),
      plan.historyDays,
      JSON.stringify(plan.capabilities),
      plan.priority,
      plan.isDefault ? 1 : 0,
    ]
  );
}
