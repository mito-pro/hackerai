import { get, run } from "./db";
import type { ProviderId } from "./model-registry";

export type ProviderHealthStatus =
  | "ok"
  | "quota"
  | "payment"
  | "auth"
  | "network"
  | "error"
  | "unknown";

export type ProviderHealth = {
  status: ProviderHealthStatus;
  message: string;
  checkedAt: string;
};

export type ProviderHealthMap = Partial<Record<ProviderId, ProviderHealth>>;

const HEALTH_KEY = "provider:health";
const CACHE_MS = 30_000;

const STATUS_LABELS: Record<ProviderHealthStatus, string> = {
  ok: "respondendo",
  quota: "cota esgotada",
  payment: "cartao de credito exigido",
  auth: "chave invalida",
  network: "sem rede / servidor fora do ar",
  error: "erro no provedor",
  unknown: "nao testado",
};

const STATUS_TTL_MS: Record<ProviderHealthStatus, number> = {
  ok: 12 * 60 * 60 * 1000,
  quota: 12 * 60 * 60 * 1000,
  payment: 12 * 60 * 60 * 1000,
  auth: 12 * 60 * 60 * 1000,
  network: 15 * 60 * 1000,
  error: 15 * 60 * 1000,
  unknown: 0,
};

const BLOCKING: ProviderHealthStatus[] = ["quota", "payment", "auth", "network", "error"];

let cache: { at: number; map: ProviderHealthMap } | null = null;

export function providerHealthLabel(status: ProviderHealthStatus) {
  return STATUS_LABELS[status] ?? STATUS_LABELS.unknown;
}

export function classifyProviderFailure(
  message: string
): ProviderHealthStatus {
  const text = (message || "").toLowerCase();

  if (
    text.includes("payment") ||
    text.includes("credit card") ||
    text.includes("cartao") ||
    text.includes("billing") ||
    text.includes("freeusage") ||
    text.includes("customer_verification_required")
  ) {
    return text.includes("freeusage") ? "quota" : "payment";
  }

  if (
    text.includes("usage limit") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("ratelimit") ||
    text.includes("too many requests") ||
    text.includes("429") ||
    text.includes("insufficient") ||
    text.includes("credit balance")
  ) {
    return "quota";
  }

  if (
    text.includes("invalid_api_key") ||
    text.includes("invalid api key") ||
    text.includes("incorrect api key") ||
    text.includes("unauthorized") ||
    text.includes("401") ||
    text.includes("forbidden") ||
    text.includes("403")
  ) {
    return "auth";
  }

  if (
    text.includes("fetch failed") ||
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    text.includes("eai_again") ||
    text.includes("timeout") ||
    text.includes("etimedout") ||
    text.includes("network")
  ) {
    return "network";
  }

  return "error";
}

export function isBlockingStatus(status: ProviderHealthStatus) {
  return BLOCKING.includes(status);
}

function parseMap(value: string | null | undefined): ProviderHealthMap {
  try {
    const parsed = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object") return parsed as ProviderHealthMap;
  } catch {
    return {};
  }
  return {};
}

export async function getProviderHealthMap(): Promise<ProviderHealthMap> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;

  const row = await get<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [HEALTH_KEY]
  );
  const map = parseMap(row?.value);
  cache = { at: Date.now(), map };
  return map;
}

async function writeMap(map: ProviderHealthMap) {
  cache = { at: Date.now(), map };
  await run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [HEALTH_KEY, JSON.stringify(map)]
  );
}

export async function getProviderHealth(
  provider: ProviderId
): Promise<ProviderHealth> {
  const map = await getProviderHealthMap();
  const entry = map[provider];
  if (!entry) {
    return { status: "unknown", message: "provedor ainda nao testado", checkedAt: "" };
  }
  const ttl = STATUS_TTL_MS[entry.status] ?? 0;
  if (ttl > 0 && Date.now() - new Date(entry.checkedAt).getTime() > ttl) {
    return { status: "unknown", message: "estado expirado, teste novamente", checkedAt: entry.checkedAt };
  }
  return entry;
}

export async function recordProviderSuccess(provider: ProviderId, note = "respondendo.") {
  const map = await getProviderHealthMap();
  map[provider] = {
    status: "ok",
    message: note.slice(0, 200),
    checkedAt: new Date().toISOString(),
  };
  await writeMap(map);
}

export async function recordProviderFailure(provider: ProviderId, message: string) {
  const status = classifyProviderFailure(message);
  const map = await getProviderHealthMap();
  map[provider] = {
    status,
    message: (message || "falha desconhecida").slice(0, 200),
    checkedAt: new Date().toISOString(),
  };
  await writeMap(map);
  return status;
}

export async function clearProviderHealth(provider: ProviderId) {
  const map = await getProviderHealthMap();
  delete map[provider];
  await writeMap(map);
}

export async function clearAllProviderHealth() {
  cache = { at: Date.now(), map: {} };
  await run("DELETE FROM settings WHERE key = ?", [HEALTH_KEY]);
}

export function healthSummary(health: ProviderHealth) {
  return {
    status: health.status,
    label: providerHealthLabel(health.status),
    message: health.message,
    checkedAt: health.checkedAt,
    blocking: isBlockingStatus(health.status),
  };
}
