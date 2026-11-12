import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.APP_SECRET;

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
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json, location: res.headers.get("location") };
}

async function otpCode(email) {
  const rows = await sql.query(
    "SELECT code_hash FROM otp_codes WHERE email = $1 AND consumed = 0 ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (!rows[0]) throw new Error("otp nao encontrado para " + email);
  const target = rows[0].code_hash;
  for (let i = 0; i < 1000000; i++) {
    const code = String(i).padStart(6, "0");
    const hash = createHmac("sha256", SECRET).update(`${email}:${code}`).digest("hex");
    if (hash === target) return code;
  }
  throw new Error("codigo nao localizado");
}

async function login(email) {
  jar.clear();
  const ask = await req("/api/auth/request-otp/", {
    method: "POST",
    body: { email },
  });
  if (ask.status !== 200) throw new Error(`request-otp ${ask.status} ${JSON.stringify(ask.json)}`);
  const code = await otpCode(email);
  const verify = await req("/api/auth/verify-otp/", {
    method: "POST",
    body: { email, code },
  });
  if (verify.status !== 200) throw new Error(`verify-otp ${verify.status} ${JSON.stringify(verify.json)}`);
  return verify.json;
}

function byProvider(models) {
  const out = {};
  for (const m of models) out[m.provider] = (out[m.provider] || 0) + 1;
  return out;
}

const results = [];
function log(label, value) {
  results.push(`${label}: ${value}`);
  console.log(`${label}: ${value}`);
}

const admin = await login("misticovurus@gmail.com");
log("login admin", `role=${admin.user.role} plan=${admin.user.plan}`);

const me = await req("/api/auth/me/");
log(
  "auth/me admin",
  `role=${me.json.user?.role} plano=${me.json.user?.plan?.name} modelos=${me.json.models?.length} ${JSON.stringify(byProvider(me.json.models || []))} providers=${JSON.stringify(me.json.user?.providers)} manutencao=${JSON.stringify(me.json.maintenance)}`
);

const users = await req("/api/admin/users/");
log("admin/users", `total=${users.json.users?.length} -> ${(users.json.users || []).map((u) => `${u.email}[${u.role}/${u.planId}]`).join(", ")}`);

const tempEmail = "e2e.temp@local.com";
await sql.query("DELETE FROM users WHERE email = $1", [tempEmail]);
const created = await req("/api/admin/users/", {
  method: "POST",
  body: { email: tempEmail, name: "E2E Temp", planId: "free", role: "user" },
});
log("admin/users POST", `status=${created.status} id=${created.json.user?.id}`);

const adminJar = new Map(jar);
const temp = await login(tempEmail);
const tempJar = new Map(jar);
log("login usuario comum", `role=${temp.user.role} plan=${temp.user.plan}`);

const selfDelete = await req("/api/admin/users/", {
  method: "DELETE",
  body: { id: "usr_qualquer" },
});
log("DELETE usuario (self/inexistente)", `status=${selfDelete.status} ${JSON.stringify(selfDelete.json)}`);

const meTemp = await req("/api/auth/me/");
log(
  "auth/me free",
  `modelos=${meTemp.json.models?.length} ${JSON.stringify(byProvider(meTemp.json.models || []))}`
);

jar.clear();
for (const [k, v] of adminJar) jar.set(k, v);
const maintOn = await req("/api/admin/settings/", {
  method: "PUT",
  body: { maintenanceEnabled: true, maintenanceMessage: "Manutencao de teste E2E." },
});
log("PUT maintenance ON (admin)", `status=${maintOn.status}`);

jar.clear();
for (const [k, v] of tempJar) jar.set(k, v);
const chatsBefore = await req("/api/chats/");
log("GET /api/chats (sem manutencao / usuario comum)", `status=${chatsBefore.status}`);

const chat = await req("/api/chat/", {
  method: "POST",
  body: { messages: [{ role: "user", content: "teste e2e" }], model: "nexus-local" },
});
log("POST /api/chat (free, nexus-local)", `status=${chat.status}`);

await req("/api/admin/settings/", {
  method: "PUT",
  body: { maintenanceEnabled: true, maintenanceMessage: "Manutencao de teste E2E." },
}).then((r) => log("PUT maintenance ON (admin)", `status=${r.status}`));
jar.clear();
for (const [k, v] of adminJar) jar.set(k, v);
const chatsBlocked = await req("/api/chats/");
log("GET /api/chats (manutencao ON)", `status=${chatsBlocked.status} ${JSON.stringify(chatsBlocked.json)}`);

const chatBlocked = await req("/api/chat/", {
  method: "POST",
  body: { messages: [{ role: "user", content: "teste e2e" }], model: "nexus-local" },
});
log("POST /api/chat (manutencao ON)", `status=${chatBlocked.status}`);

const pageBlocked = await req("/chat/");
log("GET /chat (usuario comum, manutencao ON)", `status=${pageBlocked.status} -> ${pageBlocked.location}`);
const pageMaint = await req("/maintenance/");
log("GET /maintenance (usuario comum)", `status=${pageMaint.status}`);
const loginBlocked = await req("/login/");
log("GET /login (usuario comum, manutencao ON)", `status=${loginBlocked.status} -> ${loginBlocked.location}`);

jar.clear();
for (const [k, v] of adminJar) jar.set(k, v);
const chatsAdmin = await req("/api/chats/");
log("GET /api/chats (admin, manutencao ON)", `status=${chatsAdmin.status}`);

jar.clear();
for (const [k, v] of tempJar) jar.set(k, v);
const maintState = await req("/api/maintenance/");
log("GET /api/maintenance", JSON.stringify(maintState.json));

jar.clear();
for (const [k, v] of adminJar) jar.set(k, v);
const maintOff = await req("/api/admin/settings/", {
  method: "PUT",
  body: {
    maintenanceEnabled: false,
    maintenanceMessage: "Sistema em manutencao. Tente novamente em alguns minutos.",
  },
});
log("PUT maintenance OFF (admin)", `status=${maintOff.status}`);
const maintState2 = await req("/api/maintenance/");
log("GET /api/maintenance (restaurado)", JSON.stringify(maintState2.json));

jar.clear();
for (const [k, v] of tempJar) jar.set(k, v);
const pageOk = await req("/chat/");
log("GET /chat (usuario comum, manutencao OFF)", `status=${pageOk.status}`);
const pageAdmin = await req("/chat/");
log("GET /chat (sem sessao)", `status=${pageAdmin.status} -> ${pageAdmin.location}`);

jar.clear();
for (const [k, v] of adminJar) jar.set(k, v);
const usersAfter = await req("/api/admin/users/");
log("admin/users final", `total=${usersAfter.json.users?.length}`);

const deleted = await req("/api/admin/users/", {
  method: "DELETE",
  body: { id: created.json.user?.id },
});
log("DELETE usuario temporario", `status=${deleted.status} ${JSON.stringify(deleted.json)}`);

const usersFinal = await req("/api/admin/users/");
const stillThere = (usersFinal.json.users || []).some(
  (u) => u.email === tempEmail
);
log("admin/users apos apagar", `total=${usersFinal.json.users?.length} temp ainda existe=${stillThere}`);

const chatsTemp = await sql.query(
  "SELECT COUNT(*) AS count FROM chats WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
  [tempEmail]
);
log("chats do usuario apagado", String(chatsTemp[0]?.count ?? 0));

await sql.query("DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)");
await sql.query("DELETE FROM otp_codes");
log("limpeza", "sessoes e otps de teste removidos");
