import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { all } from "@/lib/db";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(300, Math.max(1, Math.floor(requestedLimit)))
    : 100;

  const chats = all<{
    id: string;
    user_id: string;
    email: string;
    title: string;
    model: string;
    message_count: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT c.*, u.email FROM chats c JOIN users u ON u.id = c.user_id
     ORDER BY c.updated_at DESC LIMIT ?`,
    [limit]
  );

  return NextResponse.json({
    chats: chats.map((chat) => ({
      id: chat.id,
      userId: chat.user_id,
      email: chat.email,
      title: chat.title,
      model: chat.model,
      messageCount: chat.message_count,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
    })),
  });
});
