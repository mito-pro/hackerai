import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const BASE = "http://localhost:3000";
const email = "misticovurus@gmail.com";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const cookies = cookieHeader();
  if (cookies) headers.cookie = cookies;
  if (options.body) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });
  for (const raw of res.headers.getSetCookie?.() || []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  const text = await res.text();
  return { status: res.status, location: res.headers.get("location"), body: text.slice(0, 120) };
}

await sql.query("UPDATE settings SET value = $1 WHERE key = $2", ["true", "maintenance:enabled"]);
console.log("maintenance habilitada no banco");

await req("/api/auth/request-otp/", { method: "POST", body: { email } });
const rows = await sql.query(
  "SELECT code_hash FROM otp_codes WHERE email = $1 AND consumed = 0 ORDER BY created_at DESC LIMIT 1",
  [email]
);
const target = rows[0].code_hash;
let code = null;
for (let i = 0; i < 1000000 && !code; i++) {
  const candidate = String(i).padStart(6, "0");
  const hash = createHmac("sha256", process.env.APP_SECRET)
    .update(`${email}:${candidate}`)
    .digest("hex");
  if (hash === target) code = candidate;
}
console.log("codigo:", code);
await req("/api/auth/verify-otp/", { method: "POST", body: { email, code } });

const me = await req("/api/auth/me/");
console.log("auth/me status", me.status, me.body.slice(0, 160));

const page = await req("/chat/");
console.log("GET /chat (admin, manutencao ON) ->", page.status, page.location);

const maint = await req("/api/maintenance/");
console.log("GET /api/maintenance ->", maint.status, maint.body);

await sql.query("UPDATE settings SET value = $1 WHERE key = $2", ["false", "maintenance:enabled"]);
console.log("maintenance desabilitada");
