import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import {
  chatToMarkdown,
  getChat,
  getChatMessages,
  parseParts,
} from "@/lib/chats";
import { getPlan, hasCapability } from "@/lib/plans";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

type ExportContext = { params: Promise<{ id: string }> };

export const GET = apiHandler<ExportContext>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const chat = await getChat(id);

  if (!chat) {
    return Response.json(
      { error: "not_found", message: "Sessao nao encontrada." },
      { status: 404 }
    );
  }
  if (chat.user_id !== user.id && user.role !== "admin") {
    return Response.json(
      { error: "forbidden", message: "Sessao de outro operador." },
      { status: 403 }
    );
  }

  if (user.role !== "admin") {
    const plan = await getPlan(user.planId) ?? await getPlan("free");

    if (!plan || !hasCapability(plan, "export_chat")) {
      return Response.json(
        {
          error: "upgrade_required",
          message:
            "Exportacao de conversas nao esta inclusa no seu plano. Fale com o admin ou use um plano PRO.",
        },
        { status: 403 }
      );
    }
  }

  const format = new URL(request.url).searchParams.get("format") ?? "md";
  const messages = await getChatMessages(id);
  const filename = `${slugify(chat.title) || "conversa"}-${chat.id.slice(-6)}.md`;

  if (format === "json") {
    return Response.json(
      {
        chat,
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: parseParts(message.parts),
          tokens: message.tokens,
          createdAt: message.created_at,
        })),
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${filename.replace(/\.md$/, ".json")}"`,
        },
      }
    );
  }

  return new Response(chatToMarkdown(chat, messages), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
