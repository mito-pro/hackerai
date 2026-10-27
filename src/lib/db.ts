import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_PLANS } from "./plans-data";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  plan_id TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  messages_today INTEGER NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL,
  day_start TEXT NOT NULL,
  token_override INTEGER,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova sessao',
  model TEXT NOT NULL DEFAULT 'nexus-local',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  parts TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  monthly_tokens INTEGER NOT NULL DEFAULT 0,
  daily_messages INTEGER NOT NULL DEFAULT 0,
  max_context INTEGER NOT NULL DEFAULT 8000,
  features TEXT NOT NULL DEFAULT '[]',
  history_days INTEGER NOT NULL DEFAULT 7,
  capabilities TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, created_at);
`;

function createDatabase() {
  const file =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "data", "hackerai.db");
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const database = new DatabaseSync(file);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec(SCHEMA);
  migrate(database);
  seedPlans(database);
  migrateOmegaCapabilities(database);
  return database;
}

function migrate(database: DatabaseSync) {
  const columns = database
    .prepare("PRAGMA table_info(plans)")
    .all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));

  if (!names.has("history_days")) {
    database.exec(
      "ALTER TABLE plans ADD COLUMN history_days INTEGER NOT NULL DEFAULT 7"
    );
  }
  if (!names.has("capabilities")) {
    database.exec(
      "ALTER TABLE plans ADD COLUMN capabilities TEXT NOT NULL DEFAULT '[]'"
    );
  }
  if (!names.has("category")) {
    database.exec(
      "ALTER TABLE plans ADD COLUMN category TEXT NOT NULL DEFAULT ''"
    );
  }
}

function seedPlans(database: DatabaseSync) {
  const insert = database.prepare(
    `INSERT OR IGNORE INTO plans
      (id, name, category, description, price, monthly_tokens, daily_messages, max_context, features, history_days, capabilities, priority, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const plan of DEFAULT_PLANS) {
    insert.run(
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
      plan.isDefault ? 1 : 0
    );
  }
  backfillPlanDefaults(database);
}

const PLAN_BACKFILL_KEY = "migration:plans-capabilities-v1";

function backfillPlanDefaults(database: DatabaseSync) {
  const marker = database
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(PLAN_BACKFILL_KEY) as { value: string } | undefined;
  if (marker) return;

  const update = database.prepare(
    `UPDATE plans SET features = ?, history_days = ?, capabilities = ?
     WHERE id = ? AND (capabilities IS NULL OR capabilities = '' OR capabilities = '[]')`
  );
  for (const plan of DEFAULT_PLANS) {
    update.run(
      JSON.stringify(plan.features),
      plan.historyDays,
      JSON.stringify(plan.capabilities),
      plan.id
    );
  }

  database
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(PLAN_BACKFILL_KEY, new Date().toISOString());
}

const OMEGA_CAPABILITY_KEY = "migration:plans-omega-uncensored-v1";

function migrateOmegaCapabilities(database: DatabaseSync) {
  const marker = database
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(OMEGA_CAPABILITY_KEY) as { value: string } | undefined;
  if (marker) return;

  const omega = DEFAULT_PLANS.find((plan) => plan.id === "nexus-omega");
  if (!omega) return;

  const row = database
    .prepare("SELECT capabilities, features FROM plans WHERE id = ?")
    .get("nexus-omega") as
    | { capabilities: string; features: string }
    | undefined;

  if (row) {
    let capabilities: string[] = [];
    try {
      const parsed = JSON.parse(row.capabilities || "[]");
      if (Array.isArray(parsed)) capabilities = parsed.map(String);
    } catch {
      capabilities = [];
    }

    if (!capabilities.includes("uncensored")) {
      capabilities.push("uncensored");
    }

    let features: string[] = [];
    try {
      const parsed = JSON.parse(row.features || "[]");
      if (Array.isArray(parsed)) features = parsed.map(String);
    } catch {
      features = [];
    }
    for (const feature of omega.features) {
      if (!features.includes(feature)) features.push(feature);
    }

    database
      .prepare(
        "UPDATE plans SET capabilities = ?, features = ? WHERE id = 'nexus-omega'"
      )
      .run(JSON.stringify(capabilities), JSON.stringify(features));
  }

  database
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(OMEGA_CAPABILITY_KEY, new Date().toISOString());
}

const globalForDb = globalThis as unknown as {
  __hackeraiDb?: DatabaseSync;
};

export const db: DatabaseSync = globalForDb.__hackeraiDb ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__hackeraiDb = db;
}

export function nowIso() {
  return new Date().toISOString();
}

export function run(sql: string, params: Array<string | number | null> = []) {
  return db.prepare(sql).run(...params);
}

export function get<T>(sql: string, params: Array<string | number | null> = []) {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T>(sql: string, params: Array<string | number | null> = []) {
  return db.prepare(sql).all(...params) as T[];
}

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  plan_id: string;
  status: "active" | "banned";
  tokens_used: number;
  messages_today: number;
  period_start: string;
  day_start: string;
  token_override: number | null;
  created_at: string;
  last_login_at: string | null;
};

export type PlanRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  monthly_tokens: number;
  daily_messages: number;
  max_context: number;
  features: string;
  history_days: number;
  capabilities: string;
  priority: number;
  is_default: number;
};

export type ChatRow = {
  id: string;
  user_id: string;
  title: string;
  model: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  user_id: string;
  role: string;
  parts: string;
  tokens: number;
  created_at: string;
};
