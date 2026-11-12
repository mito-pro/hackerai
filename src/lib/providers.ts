import { createGroq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import {
  COMPATIBLE_PROVIDERS,
  PROVIDER_LABELS,
  compatibleModelDef,
  type CompatibleProviderId,
  type ModelDef,
  type ProviderId,
} from "./model-registry";
import { getProviderKeys } from "./settings";

export type { ProviderId };
export { PROVIDER_LABELS };

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export async function providerAvailability(): Promise<Record<ProviderId, boolean>> {
  const keys = await getProviderKeys();
  return {
    local: true,
    groq: Boolean(keys.groq),
    google: Boolean(keys.google),
    openrouter: Boolean(keys.openrouter),
    ollama: keys.ollamaConfigured,
    cerebras: Boolean(keys.cerebras),
    sambanova: Boolean(keys.sambanova),
    nvidia: Boolean(keys.nvidia),
    opencode: Boolean(keys.opencode),
    vercel: Boolean(keys.vercel),
    runapi: Boolean(keys.runapi),
    uncensored: true,
  };
}

export async function listOllamaModels() {
  const keys = await getProviderKeys();
  const base = keys.ollamaBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/models`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as {
    data?: Array<{ id?: string; name?: string }>;
  };
  const models = Array.isArray(payload.data) ? payload.data : [];
  return models
    .map((item) => item.id || item.name || "")
    .filter(Boolean);
}

export async function listCompatibleModels(
  providerId: CompatibleProviderId
): Promise<ModelDef[]> {
  const provider = COMPATIBLE_PROVIDERS.find(
    (item) => item.id === providerId
  );
  if (!provider) return [];

  const keys = await getProviderKeys();
  const apiKey = providerId === "uncensored" ? "" : keys[providerId];
  if (providerId !== "uncensored" && !apiKey) return [];

  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: providerId === "uncensored" ? undefined : { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };
    const items = Array.isArray(payload.data) ? payload.data : [];
    const seen = new Set<string>();
    const models: ModelDef[] = [];

    for (const item of items) {
      const modelId = (item.id || "").trim();
      if (!modelId || seen.has(modelId)) continue;
      seen.add(modelId);
      models.push(compatibleModelDef(provider.id, modelId));
    }

    return models;
  } catch {
    return [];
  }
}

export async function listCompatibleModelsByProvider() {
  const availability = await providerAvailability();
  const results = await Promise.all(
    COMPATIBLE_PROVIDERS.map(async (provider) =>
      availability[provider.id]
        ? await listCompatibleModels(provider.id)
        : ([] as ModelDef[])
    )
  );
  return results.flat();
}

export async function getLanguageModel(model: ModelDef): Promise<LanguageModel> {
  const keys = await getProviderKeys();

  switch (model.provider) {
    case "groq": {
      if (!keys.groq) {
        throw new ProviderError(
          "Chave da Groq ausente. Adicione em Admin > Provedores.",
          "groq"
        );
      }
      const groq = createGroq({ apiKey: keys.groq });
      return groq(model.modelId);
    }
    case "google": {
      if (!keys.google) {
        throw new ProviderError(
          "Chave do Google AI Studio ausente. Adicione em Admin > Provedores.",
          "google"
        );
      }
      return google(model.modelId);
    }
    case "openrouter": {
      if (!keys.openrouter) {
        throw new ProviderError(
          "Chave do OpenRouter ausente. Adicione em Admin > Provedores.",
          "openrouter"
        );
      }
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: keys.openrouter,
        headers: {
          "HTTP-Referer": "https://hackerai.local",
          "X-Title": "HACKER AI",
        },
      });
      return openrouter(model.modelId);
    }
    case "opencode": {
      if (!keys.opencode) {
        throw new ProviderError(
          "Chave do OpenCode ausente. Adicione em Admin > Provedores.",
          "opencode"
        );
      }
      const opencode = createOpenAICompatible({
        name: "opencode",
        baseURL: "https://opencode.ai/inference/v1",
        apiKey: keys.opencode,
      });
      return opencode(model.modelId);
    }
    case "vercel": {
      if (!keys.vercel) {
        throw new ProviderError(
          "Chave do Vercel AI Gateway ausente. Adicione em Admin > Provedores.",
          "vercel"
        );
      }
      const gateway = createOpenAICompatible({
        name: "vercel",
        baseURL: "https://ai-gateway.vercel.sh/v1",
        apiKey: keys.vercel,
      });
      return gateway(model.modelId);
    }
    case "ollama": {
      const ollama = createOpenAICompatible({
        name: "ollama",
        baseURL: keys.ollamaBaseUrl,
        apiKey: "ollama",
      });
      const tag = model.useConfiguredModel
        ? keys.ollamaModel || model.modelId
        : model.modelId;
      return ollama(tag);
    }
    case "cerebras":
    case "sambanova":
    case "nvidia":
    case "uncensored": {
      const provider = COMPATIBLE_PROVIDERS.find(
        (item) => item.id === model.provider
      );
      if (!provider) {
        throw new ProviderError("Provedor desconhecido.", model.provider);
      }
      const providerKey = model.provider as keyof Pick<
        Awaited<ReturnType<typeof getProviderKeys>>,
        "groq" | "google" | "openrouter" | "cerebras" | "sambanova" | "nvidia"
      >;
      const apiKey = keys[providerKey] || "local";
      const compatible = createOpenAICompatible({
        name: provider.id,
        baseURL: provider.baseUrl,
        apiKey,
      });
      return compatible(model.modelId);
    }
    default:
      throw new ProviderError(
        "Motor local nao utiliza provedor externo.",
        "local"
      );
  }
}
