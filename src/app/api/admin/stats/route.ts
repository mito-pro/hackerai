import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { all, get } from "@/lib/db";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();

  const totals = await get<{
    users: number;
    active: number;
    banned: number;
    messages: number;
    tokens: number;
    chats: number;
    sessions: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE status = 'active') AS active,
      (SELECT COUNT(*) FROM users WHERE status = 'banned') AS banned,
      (SELECT COUNT(*) FROM messages) AS messages,
      (SELECT COUNT(*) FROM chats) AS chats,
      (SELECT COUNT(*) FROM sessions) AS sessions,
      (SELECT COALESCE(SUM(total_tokens), 0) FROM usage_logs) AS tokens`
  );

  const windowStart = new Date(Date.now() - 29 * 86_400_000).toISOString();
  const daily = await all<{ day: string; requests: number; tokens: number }>(
    `SELECT LEFT(created_at, 10) AS day,
            COUNT(*) AS requests,
            COALESCE(SUM(total_tokens), 0) AS tokens
     FROM usage_logs
     WHERE created_at >= ?
     GROUP BY day ORDER BY day ASC`,
    [windowStart]
  );

  const byProvider = await all<{ provider: string; requests: number; tokens: number }>(
    `SELECT provider, COUNT(*) AS requests, COALESCE(SUM(total_tokens), 0) AS tokens
     FROM usage_logs GROUP BY provider ORDER BY tokens DESC`
  );

  const topUsers = await all<{
    id: string;
    email: string;
    name: string;
    plan_id: string;
    tokens_used: number;
    requests: number;
  }>(
    `SELECT u.id, u.email, u.name, u.plan_id, u.tokens_used,
            (SELECT COUNT(*) FROM usage_logs l WHERE l.user_id = u.id) AS requests
     FROM users u ORDER BY u.tokens_used DESC LIMIT 10`
  );

  const recentUsers = await all<{
    id: string;
    email: string;
    role: string;
    plan_id: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
    tokens_used: number;
  }>(
    `SELECT id, email, role, plan_id, status, created_at, last_login_at, tokens_used
     FROM users ORDER BY created_at DESC LIMIT 10`
  );

  return NextResponse.json({
    totals: {
      users: totals?.users ?? 0,
      active: totals?.active ?? 0,
      banned: totals?.banned ?? 0,
      messages: totals?.messages ?? 0,
      tokens: totals?.tokens ?? 0,
      chats: totals?.chats ?? 0,
      sessions: totals?.sessions ?? 0,
    },
    daily,
    byProvider,
    topUsers,
    recentUsers,
  });
});
