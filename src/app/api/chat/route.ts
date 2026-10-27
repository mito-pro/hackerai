import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { ensureChat, saveMessage, titleFromMessage, touchChat } from "@/lib/chats";
import { nexusReply } from "@/lib/nexus";
import { getLanguageModel, providerAvailability } from "@/lib/providers";
import { hasCapability } from "@/lib/plans";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkQuota,
  incrementMessageCount,
  planForUser,
  rateLimitFor,
  recordUsage,
  syncCounters,
} from "@/lib/usage";
import { estimateTokens, generateId } from "@/lib/utils";
import { OMEGA_SYSTEM_PROMPT, listOmegaModels, resolveModel } from "@/lib/omega";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Voce e NEXUS, o nucleo de IA de um terminal cyberpunk.
Responda sempre em portugues do Brasil, de forma direta, tecnica e bem estruturada.
Use markdown, listas e blocos de codigo com a linguagem indicada.
Se nao souber a resposta, diga claramente. Nunca invente resultados de execucao.
Contexto do operador: plano, cota de tokens e provedores disponiveis sao informados pelo painel.`;

type ChatBody = {
  id?: string;
  model?: string;
  messages?: UIMessage[];
};

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

function splitForStream(text: string) {
  const chunks = text.match(/.{1,24}(\s|$)/g);
  return chunks && chunks.length > 0 ? chunks : [text];
}

function trimToBudget(messages: UIMessage[], budget: number) {
  const kept: UIMessage[] = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const tokens = estimateTokens(textFromParts(message.parts));
    if (kept.length > 0 && used + tokens > budget) break;
    kept.unshift(message);
    used += tokens;
  }

  return { messages: kept, tokens: used };
}

export const POST = apiHandler(async (request: Request) => {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const user = await requireUser();
  const fresh = syncCounters(user.id);
  if (!fresh) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sessao expirada." },
      { status: 401 }
    );
  }

  const plan = planForUser(fresh);
  const quota = checkQuota(fresh, plan);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.code, message: quota.message },
      { status: quota.code === "token_limit" ? 402 : 429 }
    );
  }

  const rate = checkRateLimit(`chat:${fresh.id}`, rateLimitFor(plan));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit",
        message: `Fila cheia: limite de ${rate.limit} requisicoes por minuto. Tente em ${rate.retryInSeconds}s.`,
      },
      { status: 429 }
    );
  }

  const availability = providerAvailability();
  const requestedId = body.model ?? "nexus-local";
  const model = await resolveModel(requestedId);

  if (!model) {
    return NextResponse.json(
      {
        error: "model_invalid",
        message: `Modelo "${requestedId}" nao existe ou nao esta disponivel.`,
      },
      { status: 400 }
    );
  }

  if (
    model.requiresCapability &&
    !hasCapability(plan, model.requiresCapability)
  ) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: `O modelo ${model.label} exige o plano NEXUS OMEGA. Troque de plano em Admin > Usuarios.`,
      },
      { status: 403 }
    );
  }

  if (model.provider !== "local" && !availability[model.provider]) {
    return NextResponse.json(
      {
        error: "provider_missing",
        message: `O provedor ${model.provider} ainda nao esta configurado. Admin > Provedores.`,
      },
      { status: 400 }
    );
  }

  const uiMessages = (body.messages ?? []) as UIMessage[];
  const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
  const userText = textFromParts(lastUser?.parts);
  const chatId = body.id ?? generateId("chat");

  ensureChat({
    id: chatId,
    userId: fresh.id,
    model: model.id,
    title: userText ? titleFromMessage(userText) : "Nova sessao",
  });
  touchChat(chatId, model.id);

  if (lastUser) {
    saveMessage({
      id: lastUser.id,
      chatId,
      userId: fresh.id,
      role: "user",
      parts: lastUser.parts,
      tokens: estimateTokens(userText),
    });
  }
  incrementMessageCount(fresh.id);

  const outputBudget = Math.min(
    4096,
    Math.max(256, Math.floor(plan.maxContext / 4))
  );
  const inputBudget = Math.max(512, plan.maxContext - outputBudget);
  const trimmed = trimToBudget(uiMessages, inputBudget);

  let usageInfo = { inputTokens: 0, outputTokens: 0 };

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      if (model.provider === "local") {
        const omegaModels = await listOmegaModels();
        const reply = nexusReply(userText, {
          planName: plan.name,
          tokensUsed: fresh.tokens_used,
          tokenLimit: quota.limit,
          messagesToday: fresh.messages_today + 1,
          dailyLimit: plan.dailyMessages,
          modelsOnline: Object.values(availability).filter(Boolean).length,
          userName: fresh.name || fresh.email,
          canExport: hasCapability(plan, "export_chat"),
          historyDays: plan.historyDays,
          maxContext: plan.maxContext,
          canUncensored: hasCapability(plan, "uncensored"),
          omegaModels: omegaModels.length,
        });

        const messageId = generateId("msg");
        writer.write({ type: "text-start", id: messageId });
        for (const chunk of splitForStream(reply)) {
          writer.write({ type: "text-delta", id: messageId, delta: chunk });
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
        writer.write({ type: "text-end", id: messageId });

        usageInfo = {
          inputTokens: estimateTokens(userText),
          outputTokens: estimateTokens(reply),
        };
        return;
      }

      const result = streamText({
        model: getLanguageModel(model),
        system: model.uncensored ? OMEGA_SYSTEM_PROMPT : SYSTEM_PROMPT,
        messages: convertToModelMessages(trimmed.messages),
        abortSignal: request.signal,
        maxOutputTokens: outputBudget,
      });

      writer.merge(result.toUIMessageStream());

      const usage = await result.usage;
      usageInfo = {
        inputTokens: usage?.inputTokens ?? trimmed.tokens,
        outputTokens: usage?.outputTokens ?? 0,
      };
    },
    onFinish: async ({ messages }) => {
      const assistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (assistant) {
        saveMessage({
          id: assistant.id,
          chatId,
          userId: fresh.id,
          role: "assistant",
          parts: assistant.parts,
          tokens: usageInfo.outputTokens,
        });
      }

      recordUsage({
        userId: fresh.id,
        chatId,
        model: model.id,
        provider: model.provider,
        inputTokens: usageInfo.inputTokens,
        outputTokens: usageInfo.outputTokens,
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[NEXUS] erro no stream:", message);
      if (message.toLowerCase().includes("api key") || message.includes("401")) {
        return "Provedor recusou a chave da API. Revise Admin > Provedores.";
      }
      if (message.toLowerCase().includes("fetch failed")) {
        return "Nao foi possivel contatar o provedor. Tente o motor NEXUS Core local.";
      }
      return `Falha no stream: ${message.slice(0, 200)}`;
    },
  });

  return createUIMessageStreamResponse({ stream });
});
