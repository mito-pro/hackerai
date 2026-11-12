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
import {
  defaultModelFor,
  findModel,
  isModelAllowedForPlan,
  providersForPlan,
  LOCAL_MODEL_ID,
} from "@/lib/model-registry";
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
import { maintenanceBlock } from "@/lib/maintenance";

export const runtime = "nodejs";
export const maxDuration = 300;

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

type StreamError = {
  provider: string;
  message: string;
  status?: number;
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

function isRetryableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("free usage limit") ||
    lower.includes("403") ||
    lower.includes("credit card") ||
    lower.includes("customer_verification_required") ||
    lower.includes("rate limit") ||
    lower.includes("quota exceeded")
  );
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
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;
  const fresh = await syncCounters(user.id);
  if (!fresh) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sessao expirada." },
      { status: 401 }
    );
  }

  const plan = await planForUser(fresh);
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

  const availability = await providerAvailability();
  const isAdmin = fresh.role === "admin";
  const planProviders = providersForPlan(plan, isAdmin);
  const requestedId =
    body.model ??
    defaultModelFor(
      availability,
      fresh.plan_id,
      isAdmin ? undefined : planProviders
    );

  const orderedModels: string[] = [];
  if (requestedId) orderedModels.push(requestedId);
  orderedModels.push(LOCAL_MODEL_ID);

  const lastError: StreamError[] = [];

  for (const modelId of orderedModels) {
    const modelDef = findModel(modelId);
    const model = modelDef ?? (await resolveModel(modelId));
    if (!model) continue;

    if (
      model.requiresCapability &&
      !hasCapability(plan, model.requiresCapability)
    ) {
      lastError.push({
        provider: model.provider,
        message: `O modelo ${model.label} exige o plano NEXUS OMEGA.`,
        status: 403,
      });
      continue;
    }

    if (
      !isModelAllowedForPlan(
        model,
        fresh.plan_id,
        fresh.role === "admin",
        plan.capabilities,
        planProviders
      )
    ) {
      lastError.push({
        provider: model.provider,
        message: `O modelo ${model.label} nao faz parte do plano ${plan.name}.`,
        status: 403,
      });
      continue;
    }

    if (model.provider !== "local" && !availability[model.provider]) {
      lastError.push({
        provider: model.provider,
        message: `Provedor ${model.provider} sem chave configurada.`,
        status: 400,
      });
      continue;
    }

    if (model.type === "image") {
      lastError.push({
        provider: model.provider,
        message: "Use /api/generate-image para imagens.",
        status: 400,
      });
      continue;
    }

    if (model.type === "audio") {
      lastError.push({
        provider: model.provider,
        message: "Use /api/generate-audio para audio.",
        status: 400,
      });
      continue;
    }

    const uiMessages = (body.messages ?? []) as UIMessage[];
    const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
    const userText = textFromParts(lastUser?.parts);
    const chatId = body.id ?? generateId("chat");

    await ensureChat({
      id: chatId,
      userId: fresh.id,
      model: model.id,
      title: userText ? titleFromMessage(userText) : "Nova sessao",
    });
    await touchChat(chatId, model.id);

    if (lastUser) {
      await saveMessage({
        id: lastUser.id,
        chatId,
        userId: fresh.id,
        role: "user",
        parts: lastUser.parts,
        tokens: estimateTokens(userText),
      });
    }
    await incrementMessageCount(fresh.id);

    const outputBudget = Math.min(
      8192,
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
          model: await getLanguageModel(model),
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
        const assistant = [...messages]
          .reverse()
          .find((m) => m.role === "assistant");
        if (assistant) {
          await saveMessage({
            id: assistant.id,
            chatId,
            userId: fresh.id,
            role: "assistant",
            parts: assistant.parts,
            tokens: usageInfo.outputTokens,
          });
        }

        await recordUsage({
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

        if (isRetryableError(message)) {
          throw new Error(`FALLBACK:${model.provider}:${message}`);
        }

        if (message.toLowerCase().includes("api key") || message.includes("401")) {
          throw new Error("Provedor recusou a chave da API. Revise Admin > Provedores.");
        }
        if (message.toLowerCase().includes("fetch failed")) {
          throw new Error("Nao foi possivel contatar o provedor. Tente o motor NEXUS Core local.");
        }
        throw new Error(`Falha no stream: ${message.slice(0, 200)}`);
      },
    });

    try {
      return createUIMessageStreamResponse({ stream });
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : String(error);
      if (errMessage.startsWith("FALLBACK:")) {
        lastError.push({
          provider: model.provider,
          message: errMessage.replace(/^FALLBACK:/, ""),
          status: 429,
        });
        continue;
      }
      throw error;
    }
  }

  const localModel = findModel(LOCAL_MODEL_ID) ?? resolveModel(LOCAL_MODEL_ID);
  if (localModel && orderedModels.includes(LOCAL_MODEL_ID) === false) {
    orderedModels.push(LOCAL_MODEL_ID);
  }

  return NextResponse.json(
    {
      error: "all_providers_failed",
      message:
        "Todos os provedores do seu plano falharam ou estao sem limite. O terminal usara o NEXUS Core local na proxima mensagem. Detalhes: " +
        lastError.map((e) => `${e.provider}: ${e.message}`).join(" | "),
      providers: lastError.map((e) => e.provider),
    },
    { status: 429 }
  );
});
