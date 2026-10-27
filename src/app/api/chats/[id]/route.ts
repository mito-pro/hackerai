import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { deleteChat, getChat, getChatMessages, parseParts } from "@/lib/chats";

export const runtime = "nodejs";

type ChatContext = { params: Promise<{ id: string }> };

export const GET = apiHandler<ChatContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const chat = getChat(id);

  if (!chat) {
    return NextResponse.json(
      { error: "not_found", message: "Sessao nao encontrada." },
      { status: 404 }
    );
  }
  if (chat.user_id !== user.id && user.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Sessao de outro operador." },
      { status: 403 }
    );
  }

  const messages = getChatMessages(id).map((row) => ({
    id: row.id,
    role: row.role,
    parts: parseParts(row.parts),
  }));

  return NextResponse.json({ chat, messages });
});

export const DELETE = apiHandler<ChatContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const chat = getChat(id);

  if (!chat) {
    return NextResponse.json(
      { error: "not_found", message: "Sessao nao encontrada." },
      { status: 404 }
    );
  }
  if (chat.user_id !== user.id && user.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Sessao de outro operador." },
      { status: 403 }
    );
  }

  const removed = deleteChat(id, chat.user_id);
  return NextResponse.json({ ok: removed });
});
