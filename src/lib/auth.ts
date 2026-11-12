import { cookies } from "next/headers";
import { all, get, nowIso, run, type UserRow } from "./db";
import { hmac, randomToken, safeEqual, sha256 } from "./crypto";
import { ApiError } from "./errors";
import { getPlan, hasCapability } from "./plans";
import { adminEmailAllowlist } from "./admins";
import { isBlockedUser } from "./blocklist";

export const SESSION_COOKIE = "hackerai_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  planId: string;
  status: "active" | "banned";
  tokensUsed: number;
  messagesToday: number;
  tokenOverride: number | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type SessionClaims = {
  sub: string;
  email: string;
  name: string;
  role: "user" | "admin";
  planId: string;
  exp: number;
  jti: string;
};

function signClaims(claims: SessionClaims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

function verifyClaims(token: string): SessionClaims | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(hmac(payload), sig)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as SessionClaims;
    if (
      !claims.sub ||
      !claims.email ||
      !claims.jti ||
      typeof claims.exp !== "number" ||
      claims.exp * 1000 < Date.now()
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function mapUser(row: UserRow): SessionUser {
  const allowlist = adminEmailAllowlist();
  // A allowlist PROMOVE admin: e-mails listados sao sempre admin.
  // E-mails fora da lista mantem o papel gravado no banco (nenhum usuario
  // perde acesso por troca de variavel de ambiente).
  const listed = allowlist.includes(row.email.trim().toLowerCase());

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: listed ? "admin" : row.role,
    planId: row.plan_id,
    status: row.status,
    tokensUsed: row.tokens_used,
    messagesToday: row.messages_today,
    tokenOverride: row.token_override,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

async function hydrateUser(claims: SessionClaims): Promise<UserRow | null> {
  const existing = await get<UserRow>("SELECT * FROM users WHERE id = ?", [
    claims.sub,
  ]);
  if (existing) return existing;

  // Usuario apagado pelo administrador: a linha sumiu mas o cookie continua
  // assinado. Sem a lista de bloqueio o INSERT abaixo recriaria a conta.
  const blocked = await isBlockedUser({
    userId: claims.sub,
    email: claims.email,
  });
  if (blocked) return null;

  // Instancia serverless com /tmp proprio: recria a linha do usuario
  // a partir do cookie assinado para o login continuar valendo.
  const now = nowIso();
  const day = new Date().toISOString().slice(0, 10);
  await run(
    `INSERT INTO users
      (id, email, name, role, plan_id, status, tokens_used, messages_today,
       period_start, day_start, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, 'active', 0, 0, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      claims.sub,
      claims.email,
      claims.name,
      claims.role === "admin" ? "admin" : "user",
      claims.planId || "free",
      day,
      day,
      now,
      now,
    ]
  );

  const byEmail = await get<UserRow>("SELECT * FROM users WHERE email = ?", [
    claims.email,
  ]);
  if (byEmail) return byEmail;

  return (await get<UserRow>("SELECT * FROM users WHERE id = ?", [claims.sub])) ?? null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = verifyClaims(token);
  if (!claims) return null;

  const row = await hydrateUser(claims);
  if (!row) return null;
  if (row.status !== "active") return null;

  return mapUser(row);
}

export async function createSession(
  userId: string,
  userAgent?: string | null
) {
  const user = await get<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) throw new ApiError(404, "user_not_found", "Usuario nao encontrado.");

  const plan = await getPlan(user.plan_id);
  if (plan && !hasCapability(plan, "multi_session")) {
    await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
  }

  const jti = `ses_${randomToken(8)}`;
  const exp = Math.floor((Date.now() + SESSION_DAYS * 86400_000) / 1000);
  const claims: SessionClaims = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
    planId: user.plan_id,
    exp,
    jti,
  };

  await   await run(
    "INSERT INTO sessions (id, user_id, token_hash, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      jti,
      user.id,
      sha256(jti),
      userAgent ?? null,
      nowIso(),
      new Date(exp * 1000).toISOString(),
    ]
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, signClaims(claims), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });

  return jti;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const claims = verifyClaims(token);
    if (claims) {
      await run("DELETE FROM sessions WHERE id = ?", [claims.jti]);
    }
  }
  store.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "unauthorized", "Sessao expirada.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new ApiError(403, "forbidden", "Acesso restrito ao administrador.");
  }
  return user;
}

export type SessionRow = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
};

export async function listSessions(): Promise<SessionRow[]> {
  await run("DELETE FROM sessions WHERE expires_at < ?", [nowIso()]);
  return await all<SessionRow>(
    `SELECT s.id, s.user_id, u.email, u.role, s.user_agent, s.created_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC`
  );
}

export async function revokeSession(sessionId: string) {
  const result = await run("DELETE FROM sessions WHERE id = ?", [sessionId]);
  return result.changes > 0;
}

export async function revokeUserSessions(userId: string) {
  const result = await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
  return result.changes > 0;
}

export async function purgeExpiredSessions() {
  const result = await run("DELETE FROM sessions WHERE expires_at < ?", [
    nowIso(),
  ]);
  return result.changes;
}
