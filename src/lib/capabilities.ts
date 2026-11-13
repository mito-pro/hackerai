export const PLAN_CAPABILITIES = [
  { key: "multi_session", label: "Multiplas sessoes simultaneas" },
  { key: "export_chat", label: "Exportar conversas" },
  { key: "priority_queue", label: "Fila prioritaria" },
  { key: "uncensored", label: "Modelos sem censura (Heretic local)" },
  { key: "pentest", label: "Pentest de sites (IA)" },
] as const;

export type PlanCapability = (typeof PLAN_CAPABILITIES)[number]["key"];

export const PLAN_CAPABILITY_KEYS = PLAN_CAPABILITIES.map(
  (item) => item.key
) as PlanCapability[];

export function isPlanCapability(value: string): value is PlanCapability {
  return PLAN_CAPABILITY_KEYS.includes(value as PlanCapability);
}

export function hasCapability(
  capabilities: string[],
  capability: PlanCapability
) {
  return capabilities.includes(capability);
}
