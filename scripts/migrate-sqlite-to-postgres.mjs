import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";

const sourcePath =
  process.env.SOURCE_DATABASE_PATH ||
  path.join(process.cwd(), "data", "hackerai.db");
const databaseUrl = (process.env.DATABASE_URL || "").trim();

if (!databaseUrl) {
  console.error("DATABASE_URL ausente. Nada migrado.");
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Banco local nao encontrado: ${sourcePath}`);
  process.exit(1);
}

const sql = neon(databaseUrl);

const TABLES = [
  "users",
  "plans",
  "chats",
  "messages",
  "usage_logs",
  "audit_logs",
  "plan_history",
  "sessions",
  "settings",
];

const source = new DatabaseSync(sourcePath);

function loadSchemaStatements() {
  const dbSource = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "db.ts"),
    "utf8"
  );
  const start = dbSource.indexOf("const SCHEMA_STATEMENTS");
  const open = dbSource.indexOf("[", start);
  const close = dbSource.indexOf("\n];", open);
  if (start < 0 || open < 0 || close < 0) {
    throw new Error("Nao foi possivel localizar SCHEMA_STATEMENTS em src/lib/db.ts");
  }
  const block = dbSource.slice(open + 1, close);
  const statements = [];
  const matcher = /`([\s\S]*?)`/g;
  let match;
  while ((match = matcher.exec(block)) !== null) {
    statements.push(match[1]);
  }
  return statements;
}

async function ensureSchema() {
  const statements = loadSchemaStatements();
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`schema: ${statements.length} comando(s) aplicado(s)`);
}

function placeholders(count) {
  return Array.from({ length: count }, () => "?").join(", ");
}

async function copyTable(table) {
  const rows = source.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) {
    console.log(`- ${table}: vazio, ignorado`);
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const columnList = columns.join(", ");
  const conflict = table === "settings" ? "key" : table === "plans" ? "id" : "id";
  const updates = columns
    .filter((column) => column !== conflict)
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    let index = 0;
    const statement = `INSERT INTO ${table} (${columnList}) VALUES (${placeholders(
      columns.length
    )}) ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`.replace(
      /\?/g,
      () => `$${++index}`
    );
    await sql.query(
      statement,
      values.map((value) => (value === undefined ? null : value))
    );
    inserted += 1;
  }

  console.log(`- ${table}: ${inserted} registro(s) copiado(s)`);
  return inserted;
}

const totals = {};
await ensureSchema();
for (const table of TABLES) {
  try {
    totals[table] = await copyTable(table);
  } catch (error) {
    console.error(`! ${table}: ${error instanceof Error ? error.message : error}`);
  }
}

const userCount = await sql.query("SELECT COUNT(*) AS total FROM users");
const planCount = await sql.query("SELECT COUNT(*) AS total FROM plans");
const chatCount = await sql.query("SELECT COUNT(*) AS total FROM chats");
const messageCount = await sql.query("SELECT COUNT(*) AS total FROM messages");

console.log("");
console.log("Migracao concluida.");
console.log(`  users:    ${userCount[0]?.total ?? 0}`);
console.log(`  plans:    ${planCount[0]?.total ?? 0}`);
console.log(`  chats:    ${chatCount[0]?.total ?? 0}`);
console.log(`  messages: ${messageCount[0]?.total ?? 0}`);
