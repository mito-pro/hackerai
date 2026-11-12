import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { all } from "@/lib/db";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(500, Math.max(1, Math.floor(requestedLimit)))
    : 100;

  const rows = await all<{
    id: string;
    user_id: string;
    email: string;
    chat_id: string | null;
    model: string;
    provider: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    created_at: string;
  }>(
    `SELECT l.*, u.email FROM usage_logs l JOIN users u ON u.id = l.user_id
     ${userId ? "WHERE l.user_id = ?" : ""}
     ORDER BY l.created_at DESC LIMIT ?`,
    userId ? [userId, limit] : [limit]
  );

  const totals = await all<{ total: number; requests: number }>(
    `SELECT COALESCE(SUM(total_tokens), 0) AS total, COUNT(*) AS requests
     FROM usage_logs ${userId ? "WHERE user_id = ?" : ""}`,
    userId ? [userId] : []
  );

  return NextResponse.json({
    logs: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      chatId: row.chat_id,
      model: row.model,
      provider: row.provider,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      createdAt: row.created_at,
    })),
    totals: {
      tokens: totals[0]?.total ?? 0,
      requests: totals[0]?.requests ?? 0,
    },
  });
});
