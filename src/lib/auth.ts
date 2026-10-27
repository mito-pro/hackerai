import { cookies } from "next/headers";
import { all, get, nowIso, run, type UserRow } from "./db";
import { randomToken, sha256 } from "./crypto";
import { ApiError } from "./errors";
import { getPlan, hasCapability } from "./plans";
import { adminEmailAllowlist } from "./admins";

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

function mapUser(row: UserRow): SessionUser {
  const allowlist = adminEmailAllowlist();
  const blocked =
    allowlist.length > 0 && !allowlist.includes(row.email.trim().toLowerCase());

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: blocked ? "user" : row.role,
    planId: row.plan_id,
    status: row.status,
    tokensUsed: row.tokens_used,
    messagesToday: row.messages_today,
    tokenOverride: row.token_override,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = get<UserRow & { session_id: string; expires_at: string }>(
    `SELECT u.*, s.id AS session_id, s.expires_at AS expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    [sha256(token)]
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run("DELETE FROM sessions WHERE id = ?", [row.session_id]);
    return null;
  }
  if (row.status !== "active") return null;

  return mapUser(row);
}

export async function createSession(
  userId: string,
  userAgent?: string | null
) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);

  const row = get<{ plan_id: string }>(
    "SELECT plan_id FROM users WHERE id = ?",
    [userId]
  );
  const plan = row ? getPlan(row.plan_id) : null;
  if (plan && !hasCapability(plan, "multi_session")) {
    run("DELETE FROM sessions WHERE user_id = ?", [userId]);
  }

  run(
    "INSERT INTO sessions (id, user_id, token_hash, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      `ses_${randomToken(8)}`,
      userId,
      sha256(token),
      userAgent ?? null,
      nowIso(),
      expires.toISOString(),
    ]
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });

  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
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

export function listSessions(): SessionRow[] {
  run("DELETE FROM sessions WHERE expires_at < ?", [nowIso()]);
  return all<SessionRow>(
    `SELECT s.id, s.user_id, u.email, u.role, s.user_agent, s.created_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC`
  );
}

export function revokeSession(sessionId: string) {
  const result = run("DELETE FROM sessions WHERE id = ?", [sessionId]);
  return result.changes > 0;
}

export function revokeUserSessions(userId: string) {
  const result = run("DELETE FROM sessions WHERE user_id = ?", [userId]);
  return result.changes > 0;
}

export function purgeExpiredSessions() {
  const result = run("DELETE FROM sessions WHERE expires_at < ?", [nowIso()]);
  return result.changes;
}
