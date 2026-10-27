import { get, run } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

export type ProviderKeyName = "groq" | "google" | "openrouter";

const SECRET_PREFIX = "provider:";

export function getSetting(key: string): string | null {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
    key,
  ]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export function deleteSetting(key: string) {
  run("DELETE FROM settings WHERE key = ?", [key]);
}

function envValue(name: string) {
  return (process.env[name] || "").trim();
}

export function readSecretSetting(key: string) {
  const stored = getSetting(key);
  if (!stored) return "";
  if (stored.startsWith("v1:")) return decryptSecret(stored);
  return stored;
}

export function writeSecretSetting(key: string, value: string) {
  if (!value) {
    deleteSetting(key);
    return;
  }
  setSetting(key, encryptSecret(value));
}

export function getProviderKeys() {
  const read = (name: ProviderKeyName) => {
    const stored = getSetting(`${SECRET_PREFIX}${name}`);
    if (stored) {
      const decrypted = decryptSecret(stored);
      if (decrypted) return decrypted;
    }
    const envKey = envValue(`${name.toUpperCase()}_API_KEY`);
    return envKey;
  };

  const ollamaBaseUrl =
    getSetting(`${SECRET_PREFIX}ollamaBaseUrl`) || envValue("OLLAMA_BASE_URL");

  return {
    groq: read("groq"),
    google: read("google"),
    openrouter: read("openrouter"),
    ollamaBaseUrl: ollamaBaseUrl || "http://127.0.0.1:11434/v1",
    ollamaModel:
      getSetting(`${SECRET_PREFIX}ollamaModel`) || envValue("OLLAMA_MODEL") || "",
    ollamaConfigured: Boolean(ollamaBaseUrl),
  };
}

export function setProviderKey(name: ProviderKeyName, value: string) {
  const key = `${SECRET_PREFIX}${name}`;
  if (!value) {
    deleteSetting(key);
    return;
  }
  setSetting(key, encryptSecret(value));
}

export function setProviderSetting(name: string, value: string) {
  const key = `${SECRET_PREFIX}${name}`;
  if (!value) {
    deleteSetting(key);
    return;
  }
  setSetting(key, value);
}

export type OtpMailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export function getOtpMailSettings(): OtpMailSettings | null {
  const host =
    getSetting("otp:smtpHost") || envValue("SMTP_HOST");
  if (!host) return null;
  const port = Number(
    getSetting("otp:smtpPort") || envValue("SMTP_PORT") || "587"
  );
  const user = getSetting("otp:smtpUser") || envValue("SMTP_USER") || "";
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure:
      (getSetting("otp:smtpSecure") || envValue("SMTP_SECURE") || "false") ===
      "true",
    user,
    pass: readSecretSetting("otp:smtpPass") || envValue("SMTP_PASS") || "",
    from:
      getSetting("otp:mailFrom") ||
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

export function getAppHost() {
  return normalizeAppHost(
    getSetting("otp:appHost") || envValue("APP_HOST") || ""
  );
}
