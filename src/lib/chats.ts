import { all, get, nowIso, run, type ChatRow, type MessageRow } from "./db";
import { generateId } from "./utils";

export async function ensureChat(params: {
  id: string;
  userId: string;
  title?: string;
  model?: string;
}) {
  const existing = await get<ChatRow>("SELECT * FROM chats WHERE id = ?", [
    params.id,
  ]);
  if (existing) return existing;

  await run(
    "INSERT INTO chats (id, user_id, title, model, message_count, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    [
      params.id,
      params.userId,
      params.title ?? "Nova sessao",
      params.model ?? "nexus-local",
      nowIso(),
      nowIso(),
    ]
  );

  return (await get<ChatRow>("SELECT * FROM chats WHERE id = ?", [params.id]))!;
}

export async function touchChat(chatId: string, model?: string) {
  if (model) {
    await run(
      "UPDATE chats SET updated_at = ?, model = ? WHERE id = ?",
      [nowIso(), model, chatId]
    );
    return;
  }
  await run("UPDATE chats SET updated_at = ? WHERE id = ?", [nowIso(), chatId]);
}

export async function saveMessage(params: {
  id?: string;
  chatId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  parts: unknown;
  tokens?: number;
}) {
  const id = params.id ?? generateId("msg");
  const exists = await get<{ id: string }>(
    "SELECT id FROM messages WHERE id = ?",
    [id]
  );

  await run(
    "INSERT INTO messages (id, chat_id, user_id, role, parts, tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET role = excluded.role, parts = excluded.parts, tokens = excluded.tokens",
    [
      id,
      params.chatId,
      params.userId,
      params.role,
      JSON.stringify(params.parts ?? []),
      params.tokens ?? 0,
      nowIso(),
    ]
  );

  if (!exists) {
    await run(
      "UPDATE chats SET message_count = message_count + 1, updated_at = ? WHERE id = ?",
      [nowIso(), params.chatId]
    );
  } else {
    await run("UPDATE chats SET updated_at = ? WHERE id = ?", [
      nowIso(),
      params.chatId,
    ]);
  }

  return id;
}

export async function listChats(userId: string, limit = 50) {
  return await all<ChatRow>(
    "SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
    [userId, limit]
  );
}

export async function getChat(chatId: string) {
  return await get<ChatRow>("SELECT * FROM chats WHERE id = ?", [chatId]);
}

export async function deleteChat(chatId: string, userId?: string) {
  const chat = await getChat(chatId);
  if (!chat) return false;
  if (userId && chat.user_id !== userId) return false;
  await run("DELETE FROM messages WHERE chat_id = ?", [chatId]);
  await run("DELETE FROM chats WHERE id = ?", [chatId]);
  return true;
}

export async function pruneChats(userId: string, historyDays: number) {
  if (!historyDays || historyDays <= 0) return 0;
  const cutoff = new Date(Date.now() - historyDays * 86_400_000).toISOString();
  const stale = await all<{ id: string }>(
    "SELECT id FROM chats WHERE user_id = ? AND updated_at < ?",
    [userId, cutoff]
  );
  for (const chat of stale) await deleteChat(chat.id);
  return stale.length;
}

export async function getChatMessages(chatId: string) {
  return await all<MessageRow>(
    "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
    [chatId]
  );
}

export function parseParts(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function partsToText(value: string) {
  return parseParts(value)
    .map((part) => {
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

export function chatToMarkdown(chat: ChatRow, messages: MessageRow[]) {
  const lines = [
    `# ${chat.title}`,
    "",
    `- operador: ${chat.user_id}`,
    `- modelo: ${chat.model}`,
    `- mensagens: ${chat.message_count}`,
    `- criada em: ${chat.created_at}`,
    `- atualizada em: ${chat.updated_at}`,
    "",
  ];

  for (const message of messages) {
    const text = partsToText(message.parts).trim();
    const label = message.role === "user" ? "Operador" : "NEXUS";
    lines.push(`## ${label}`, "", text || "_(vazio)_", "");
  }

  return lines.join("\n");
}

export function titleFromMessage(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nova sessao";
  return clean.length > 48 ? `${clean.slice(0, 48)}...` : clean;
}
