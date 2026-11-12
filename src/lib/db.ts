import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";
import { DEFAULT_PLANS } from "./plans-data";
import { writableFile } from "./storage";

export type SqlParam = string | number | null | undefined;

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
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
    last_login_at TEXT,
    expires_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Nova sessao',
    model TEXT NOT NULL DEFAULT 'nexus-local',
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    parts TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chat_id TEXT,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    target_email TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plan_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    old_plan_id TEXT,
    new_plan_id TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_by_email TEXT,
    reason TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    price DOUBLE PRECISION NOT NULL DEFAULT 0,
    monthly_tokens INTEGER NOT NULL DEFAULT 0,
    daily_messages INTEGER NOT NULL DEFAULT 0,
    max_context INTEGER NOT NULL DEFAULT 8000,
    features TEXT NOT NULL DEFAULT '[]',
    history_days INTEGER NOT NULL DEFAULT 7,
    capabilities TEXT NOT NULL DEFAULT '[]',
    providers TEXT NOT NULL DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    amount REAL NOT NULL,
    pix_key TEXT NOT NULL,
    pix_qr_code TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    activation_code TEXT,
    code_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS upgrade_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    current_plan_id TEXT NOT NULL,
    requested_plan_id TEXT NOT NULL,
    requested_plan_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    activation_code TEXT,
    pix_key TEXT,
    admin_notes TEXT,
    resolved_at TEXT,
    resolved_by TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_blocklist (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'deleted',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`,
  `CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user ON upgrade_requests(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON upgrade_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id)`,
  `CREATE INDEX IF NOT EXISTS idx_plan_history_user ON plan_history(user_id, created_at DESC)`,
];

const DATABASE_URL = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  ""
).trim();

export const USING_POSTGRES = Boolean(DATABASE_URL);

let pgClient: ReturnType<typeof neon> | null = null;

function postgres() {
  if (!pgClient) pgClient = neon(DATABASE_URL);
  return pgClient;
}

async function pgQuery(text: string, params: SqlParam[] = []) {
  const rows = await postgres().query(text, params);
  return (rows ?? []) as Record<string, unknown>[];
}

function toPostgresSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function withReturning(sql: string) {
  if (/\breturning\b/i.test(sql)) return sql;
  if (!/^\s*(insert|update|delete)\b/i.test(sql)) return sql;
  return `${sql} RETURNING 1`;
}

function normalizeParams(params: SqlParam[]) {
  return params.map((value) => (value === undefined ? null : value));
}

function normalizeSqliteParams(params: SqlParam[]) {
  return params.map((value) => (value === undefined ? null : value));
}

const globalForDb = globalThis as unknown as {
  __hackeraiDb?: DatabaseSync;
  __hackeraiInit?: Promise<void>;
};

let sqliteDatabase: DatabaseSync | null = null;

function createDatabase() {
  const file =
    process.env.DATABASE_PATH || writableFile("hackerai.db");
  const dir = path.dirname(file);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    // Sistema de arquivos somente leitura (serverless): usa /tmp.
    const fallback = path.join(os.tmpdir(), "hackerai");
    fs.mkdirSync(fallback, { recursive: true });
    return openDatabase(path.join(fallback, "hackerai.db"));
  }

  return openDatabase(file);
}

function openDatabase(file: string) {
  const database = new DatabaseSync(file);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  for (const statement of SCHEMA_STATEMENTS) database.exec(statement);
  migrateSqlite(database);
  migrateUsersSqlite(database);
  seedPlansSqlite(database);
  migratePlanProvidersSqlite(database);
  migrateOmegaCapabilitiesSqlite(database);
  return database;
}

function sqlite() {
  if (!sqliteDatabase) {
    sqliteDatabase = globalForDb.__hackeraiDb ?? createDatabase();
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__hackeraiDb = sqliteDatabase;
    }
  }
  return sqliteDatabase;
}

function migrateSqlite(database: DatabaseSync) {
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
  if (!names.has("providers")) {
    database.exec(
      "ALTER TABLE plans ADD COLUMN providers TEXT NOT NULL DEFAULT '[]'"
    );
  }
}

function migrateUsersSqlite(database: DatabaseSync) {
  const columns = database
    .prepare("PRAGMA table_info(users)")
    .all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("expires_at")) {
    database.exec("ALTER TABLE users ADD COLUMN expires_at TEXT");
  }
  if (!names.has("token_override")) {
    database.exec("ALTER TABLE users ADD COLUMN token_override INTEGER");
  }
}

function seedPlansSqlite(database: DatabaseSync) {
  const insert = database.prepare(
    `INSERT INTO plans
      (id, name, category, description, price, monthly_tokens, daily_messages, max_context, features, history_days, capabilities, providers, priority, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`
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
      JSON.stringify(plan.providers),
      plan.priority,
      plan.isDefault ? 1 : 0
    );
  }
  backfillPlanDefaultsSqlite(database);
}

const PLAN_BACKFILL_KEY = "migration:plans-capabilities-v1";

function backfillPlanDefaultsSqlite(database: DatabaseSync) {
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

const PLAN_PROVIDERS_KEY = "migration:plans-providers-v1";

function migratePlanProvidersSqlite(database: DatabaseSync) {
  const marker = database
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(PLAN_PROVIDERS_KEY) as { value: string } | undefined;
  if (marker) return;

  const update = database.prepare(
    `UPDATE plans SET providers = ?
     WHERE id = ? AND (providers IS NULL OR providers = '' OR providers = '[]')`
  );
  for (const plan of DEFAULT_PLANS) {
    update.run(JSON.stringify(plan.providers), plan.id);
  }

  database
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(PLAN_PROVIDERS_KEY, new Date().toISOString());
}

const OMEGA_CAPABILITY_KEY = "migration:plans-omega-uncensored-v1";

function migrateOmegaCapabilitiesSqlite(database: DatabaseSync) {
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
    const capabilities = parseJsonList(row.capabilities);
    if (!capabilities.includes("uncensored")) {
      capabilities.push("uncensored");
    }

    const features = parseJsonList(row.features);
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

function parseJsonList(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return [];
  }
  return [];
}

async function postgresColumnExists(table: string, column: string) {
  const rows = await pgQuery(toPostgresSql(
      "SELECT 1 AS present FROM information_schema.columns WHERE table_name = ? AND column_name = ? LIMIT 1"
    ),
    [table, column]
  );
  return rows.length > 0;
}

async function initPostgres() {
  for (const statement of SCHEMA_STATEMENTS) {
    await pgQuery(statement);
  }

  const columns: Array<[string, string]> = [
    ["history_days", "INTEGER NOT NULL DEFAULT 7"],
    ["capabilities", "TEXT NOT NULL DEFAULT '[]'"],
    ["category", "TEXT NOT NULL DEFAULT ''"],
    ["providers", "TEXT NOT NULL DEFAULT '[]'"],
  ];
  for (const [column, definition] of columns) {
    if (await postgresColumnExists("plans", column)) continue;
    await pgQuery(`ALTER TABLE plans ADD COLUMN ${column} ${definition}`);
  }

  for (const plan of DEFAULT_PLANS) {
    await pgQuery(toPostgresSql(
        `INSERT INTO plans
          (id, name, category, description, price, monthly_tokens, daily_messages, max_context, features, history_days, capabilities, providers, priority, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`
      ),
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
        JSON.stringify(plan.providers),
        plan.priority,
        plan.isDefault ? 1 : 0,
      ]
    );
  }

  const providersMarker = await pgQuery(
    toPostgresSql("SELECT value FROM settings WHERE key = ?"),
    [PLAN_PROVIDERS_KEY]
  );
  if (!providersMarker.length) {
    for (const plan of DEFAULT_PLANS) {
      await pgQuery(
        toPostgresSql(
          `UPDATE plans SET providers = ?
           WHERE id = ? AND (providers IS NULL OR providers = '' OR providers = '[]')`
        ),
        [JSON.stringify(plan.providers), plan.id]
      );
    }
    await pgQuery(
      toPostgresSql(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"
      ),
      [PLAN_PROVIDERS_KEY, new Date().toISOString()]
    );
  }

  await postgres()
    .query(
      toPostgresSql(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"
      ),
      [PLAN_BACKFILL_KEY, new Date().toISOString()]
    )
    .catch(() => undefined);

  await postgres()
    .query(
      toPostgresSql(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"
      ),
      [OMEGA_CAPABILITY_KEY, new Date().toISOString()]
    )
    .catch(() => undefined);
}

async function ensureReady() {
  if (!USING_POSTGRES) return;
  if (!globalForDb.__hackeraiInit) {
    globalForDb.__hackeraiInit = initPostgres().catch((error) => {
      globalForDb.__hackeraiInit = undefined;
      throw error;
    });
  }
  await globalForDb.__hackeraiInit;
}

export function nowIso() {
  return new Date().toISOString();
}

export type RunResult = {
  changes: number;
  lastInsertRowid: number;
};

export async function run(
  sql: string,
  params: SqlParam[] = []
): Promise<RunResult> {
  if (USING_POSTGRES) {
    await ensureReady();
    const rows = await pgQuery(withReturning(toPostgresSql(sql)),
      normalizeParams(params)
    );
    return { changes: rows.length, lastInsertRowid: 0 };
  }

  const result = sqlite()
    .prepare(sql)
    .run(...(normalizeSqliteParams(params) as Array<string | number | null>));
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
  };
}

export async function get<T>(
  sql: string,
  params: SqlParam[] = []
): Promise<T | undefined> {
  if (USING_POSTGRES) {
    await ensureReady();
    const rows = await pgQuery(toPostgresSql(sql),
      normalizeParams(params)
    );
    return (rows[0] as T | undefined) ?? undefined;
  }

  return sqlite()
    .prepare(sql)
    .get(...(normalizeSqliteParams(params) as Array<string | number | null>)) as
    | T
    | undefined;
}

export async function all<T>(
  sql: string,
  params: SqlParam[] = []
): Promise<T[]> {
  if (USING_POSTGRES) {
    await ensureReady();
    const rows = await pgQuery(toPostgresSql(sql),
      normalizeParams(params)
    );
    return rows as T[];
  }

  return sqlite()
    .prepare(sql)
    .all(...(normalizeSqliteParams(params) as Array<string | number | null>)) as T[];
}

export async function exec(sql: string) {
  if (USING_POSTGRES) {
    await ensureReady();
    for (const statement of sql.split(";")) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      await pgQuery(trimmed);
    }
    return;
  }
  sqlite().exec(sql);
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
  providers: string;
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
