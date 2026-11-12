import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import {
  providerAvailability,
  listOllamaModels,
  listCompatibleModelsByProvider,
} from "@/lib/providers";
import { listModels, type ModelDef, type ProviderId } from "@/lib/model-registry";
import { getLanguageModel } from "@/lib/providers";
import { generateText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 120;

type PingResult = {
  ok: boolean;
  message: string;
  latencyMs: number;
};

async function pingModel(model: ModelDef): Promise<PingResult> {
  const started = Date.now();
  try {
    await generateText({
      model: await getLanguageModel(model),
      prompt: "ping",
      maxOutputTokens: 8,
    });
    return {
      ok: true,
      message: "respondeu em streaming.",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: message.slice(0, 180),
      latencyMs: Date.now() - started,
    };
  }
}

export const POST = apiHandler(async () => {
  await requireAdmin();

  const availability = await providerAvailability();

  const staticModels = listModels({
    hasGroq: availability.groq,
    hasGoogle: availability.google,
    hasOpenRouter: availability.openrouter,
    hasOllama: availability.ollama,
    hasNvidia: availability.nvidia,
    hasOpenCode: availability.opencode,
    hasVercel: availability.vercel,
    hasRunapi: availability.runapi,
  });

  const dynamicModels = await listCompatibleModelsByProvider();
  const models = [...staticModels, ...dynamicModels];

  const byProvider = new Map<ProviderId, ModelDef[]>();
  for (const model of models) {
    const list = byProvider.get(model.provider) ?? [];
    list.push(model);
    byProvider.set(model.provider, list);
  }

  const results: {
    id: string;
    label: string;
    provider: string;
    status: "ok" | "error";
    message: string;
    latencyMs?: number;
  }[] = [];

  const providerPings = new Map<ProviderId, PingResult>();

  for (const [provider, list] of byProvider) {
    if (provider === "local") {
      providerPings.set(provider, {
        ok: true,
        message: "Motor local offline (sem chave necessaria).",
        latencyMs: 0,
      });
      continue;
    }

    if (!availability[provider]) {
      providerPings.set(provider, {
        ok: false,
        message: "Chave nao configurada em Admin > Provedores.",
        latencyMs: 0,
      });
      continue;
    }

    if (provider === "ollama") {
      try {
        const installed = await listOllamaModels();
        providerPings.set(provider, {
          ok: true,
          message: `Ollama respondendo (${installed.length} modelo(s) instalado(s)).`,
          latencyMs: 0,
        });
      } catch (error) {
        providerPings.set(provider, {
          ok: false,
          message:
            error instanceof Error ? error.message.slice(0, 180) : "sem resposta",
          latencyMs: 0,
        });
      }
      continue;
    }

    providerPings.set(provider, await pingModel(list[0]));
  }

  for (const model of models) {
    const ping = providerPings.get(model.provider);
    if (!ping) continue;
    const isProbe = byProvider.get(model.provider)?.[0]?.id === model.id;
    results.push({
      id: model.id,
      label: model.label,
      provider: model.provider,
      status: ping.ok ? "ok" : "error",
      message: isProbe ? ping.message : `provedor ${ping.ok ? "ok" : "com erro"}`,
      latencyMs: isProbe ? ping.latencyMs : undefined,
    });
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    total: results.length,
    ok: okCount,
    error: errorCount,
    providers: [...providerPings.entries()].map(([provider, ping]) => ({
      provider,
      ok: ping.ok,
      message: ping.message,
      latencyMs: ping.latencyMs,
    })),
    results,
  });
});
