import { get, run } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

export type ProviderKeyName =
  | "groq"
  | "google"
  | "openrouter"
  | "cerebras"
  | "sambanova"
  | "nvidia"
  | "opencode"
  | "vercel"
  | "uncensored"
  | "runapi";

const SECRET_PREFIX = "provider:";

const PROVIDER_ENV_KEYS: Record<ProviderKeyName, string[]> = {
  groq: ["GROQ_API_KEY"],
  google: ["GOOGLE_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  sambanova: ["SAMBANOVA_API_KEY"],
  nvidia: ["NVIDIA_API_KEY"],
  opencode: ["OPENCODE_API_KEY"],
  vercel: ["VERCEL_AI_GATEWAY_API_KEY", "AI_GATEWAY_API_KEY"],
  uncensored: ["UNCENSORED_API_KEY"],
  runapi: ["RUNPI_API_KEY"],
};

export async function getSetting(key: string): Promise<string | null> {
  const row = await get<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function deleteSetting(key: string) {
  await run("DELETE FROM settings WHERE key = ?", [key]);
}

function envValue(name: string) {
  return (process.env[name] || "").trim();
}

export async function readSecretSetting(key: string) {
  const stored = await getSetting(key);
  if (!stored) return "";
  if (stored.startsWith("v1:")) return decryptSecret(stored);
  return stored;
}

export async function writeSecretSetting(key: string, value: string) {
  if (!value) {
    await deleteSetting(key);
    return;
  }
  await setSetting(key, encryptSecret(value));
}

export async function getProviderKeys() {
  const read = async (name: ProviderKeyName) => {
    const stored = await getSetting(`${SECRET_PREFIX}${name}`);
    if (stored) {
      const decrypted = decryptSecret(stored);
      if (decrypted) return decrypted;
    }
    for (const envKey of PROVIDER_ENV_KEYS[name]) {
      const value = envValue(envKey);
      if (value) return value;
    }
    return "";
  };

  const ollamaBaseUrl =
    (await getSetting(`${SECRET_PREFIX}ollamaBaseUrl`)) ||
    envValue("OLLAMA_BASE_URL");

  const ollamaModel =
    (await getSetting(`${SECRET_PREFIX}ollamaModel`)) ||
    envValue("OLLAMA_MODEL") ||
    "";

  return {
    groq: await read("groq"),
    google: await read("google"),
    openrouter: await read("openrouter"),
    cerebras: await read("cerebras"),
    sambanova: await read("sambanova"),
    nvidia: await read("nvidia"),
    opencode: await read("opencode"),
    vercel: await read("vercel"),
    runapi: await read("runapi"),
    ollamaBaseUrl: ollamaBaseUrl || "http://127.0.0.1:11434/v1",
    ollamaModel,
    ollamaConfigured: Boolean(ollamaBaseUrl),
  };
}

export async function setProviderKey(name: ProviderKeyName, value: string) {
  const key = `${SECRET_PREFIX}${name}`;
  if (!value) {
    await deleteSetting(key);
    return;
  }
  await setSetting(key, encryptSecret(value));
}

export async function setProviderSetting(name: string, value: string) {
  const key = `${SECRET_PREFIX}${name}`;
  if (!value) {
    await deleteSetting(key);
    return;
  }
  await setSetting(key, value);
}

export type OtpMailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export async function getOtpMailSettings(): Promise<OtpMailSettings | null> {
  const host =
    (await getSetting("otp:smtpHost")) || envValue("SMTP_HOST");
  if (!host) return null;
  const port = Number(
    (await getSetting("otp:smtpPort")) || envValue("SMTP_PORT") || "587"
  );
  const safePort = Number.isFinite(port) ? port : 587;
  const user = (await getSetting("otp:smtpUser")) || envValue("SMTP_USER") || "";
  const secureSetting =
    ((await getSetting("otp:smtpSecure")) ||
      envValue("SMTP_SECURE") ||
      "false") === "true";
  // 465 usa TLS implicito; 587 usa STARTTLS. Configuracao inconsistente
  // quebra o handshake, entao a porta define o modo correto.
  const secure = safePort === 465 ? true : safePort === 587 ? false : secureSetting;
  return {
    host,
    port: safePort,
    secure,
    user,
    pass:
      (await readSecretSetting("otp:smtpPass")) || envValue("SMTP_PASS") || "",
    from:
      (await getSetting("otp:mailFrom")) ||
      envValue("MAIL_FROM") ||
      defaultMailFrom(user),
  };
}

function defaultMailFrom(user: string) {
  if (user.includes("@")) return `HACKER AI <${user}>`;
  return "HACKER AI <no-reply@hackerai.local>";
}

export function normalizeAppHost(value: string | null | undefined) {
  if (!value) return "";
  let host = value.trim();
  if (!host) return "";
  host = host.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  host = host.split("/")[0];
  host = host.split("@").pop() ?? host;
  host = host.replace(/:\d+$/, "");
  host = host.replace(/^\[/, "").replace(/\]$/, "");
  if (!host) return "";
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(host)) return "";
  return host.toLowerCase();
}

export async function getAppHost() {
  return normalizeAppHost(
    (await getSetting("otp:appHost")) || envValue("APP_HOST") || ""
  );
}

export type R2Config = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
};

export async function getR2Config(): Promise<R2Config | null> {
  const accountId =
    (await getSetting("r2:accountId")) || envValue("R2_ACCOUNT_ID") || "";
  const bucketName =
    (await getSetting("r2:bucketName")) || envValue("R2_BUCKET_NAME") || "";
  const accessKeyId =
    (await getSetting("r2:accessKeyId")) || envValue("R2_ACCESS_KEY_ID") || "";
  const secretAccessKey =
    (await readSecretSetting("r2:secretAccessKey")) ||
    envValue("R2_SECRET_ACCESS_KEY") ||
    "";
  const publicUrl =
    (await getSetting("r2:publicUrl")) ||
    envValue("R2_PUBLIC_URL") ||
    "";

  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accountId,
    bucketName,
    accessKeyId,
    secretAccessKey,
    publicUrl: publicUrl || `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export async function getMaintenance() {
  return {
    enabled: (await getSetting("maintenance:enabled")) === "true",
    message:
      (await getSetting("maintenance:message")) ||
      "Sistema em manutencao. Tente novamente em alguns minutos.",
  };
}

export async function setMaintenance(enabled: boolean, message?: string) {
  await setSetting("maintenance:enabled", enabled ? "true" : "false");
  if (message !== undefined) await setSetting("maintenance:message", message.trim());
}
