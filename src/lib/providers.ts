import { createGroq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { PROVIDER_LABELS, type ModelDef } from "./model-registry";
import { getProviderKeys } from "./settings";

export type { ProviderId } from "./model-registry";
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

export function providerAvailability() {
  const keys = getProviderKeys();
  return {
    local: true,
    groq: Boolean(keys.groq),
    google: Boolean(keys.google),
    openrouter: Boolean(keys.openrouter),
    ollama: keys.ollamaConfigured,
  };
}

export async function listOllamaModels() {
  const keys = getProviderKeys();
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

export function getLanguageModel(model: ModelDef): LanguageModel {
  const keys = getProviderKeys();

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
    default:
      throw new ProviderError(
        "Motor local nao utiliza provedor externo.",
        "local"
      );
  }
}
