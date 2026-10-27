import type { PlanCapability } from "./capabilities";

export type ProviderId = "local" | "groq" | "google" | "openrouter" | "ollama";

export type ModelDef = {
  id: string;
  label: string;
  provider: ProviderId;
  modelId: string;
  context: number;
  requiresKey: boolean;
  description: string;
  free: boolean;
  uncensored?: boolean;
  requiresCapability?: PlanCapability;
  useConfiguredModel?: boolean;
};

export const MODELS: ModelDef[] = [
  {
    id: "nexus-local",
    label: "NEXUS Core",
    provider: "local",
    modelId: "nexus-core",
    context: 8_192,
    requiresKey: false,
    description: "Motor offline integrado. Roda sem chave de API.",
    free: true,
  },
  {
    id: "groq/llama-3.3-70b",
    label: "Groq · Llama 3.3 70B",
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    context: 32_768,
    requiresKey: true,
    description: "Plano gratuito da Groq, latencia baixa.",
    free: true,
  },
  {
    id: "groq/llama-3.1-8b",
    label: "Groq · Llama 3.1 8B",
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
    context: 32_768,
    requiresKey: true,
    description: "Modelo rapido e leve para operacoes curtas.",
    free: true,
  },
  {
    id: "google/gemini-flash",
    label: "Gemini · Flash",
    provider: "google",
    modelId: "gemini-2.0-flash",
    context: 1_048_576,
    requiresKey: true,
    description: "Google AI Studio com cota gratuita.",
    free: true,
  },
  {
    id: "openrouter/deepseek-free",
    label: "OpenRouter · DeepSeek (free)",
    provider: "openrouter",
    modelId: "deepseek/deepseek-chat-v3-0324:free",
    context: 32_768,
    requiresKey: true,
    description: "Roteamento free do OpenRouter.",
    free: true,
  },
  {
    id: "openrouter/llama-free",
    label: "OpenRouter · Llama 3.3 (free)",
    provider: "openrouter",
    modelId: "meta-llama/llama-3.3-70b-instruct:free",
    context: 32_768,
    requiresKey: true,
    description: "Alternativa gratuita via OpenRouter.",
    free: true,
  },
  {
    id: "ollama/local",
    label: "Ollama · Modelo local",
    provider: "ollama",
    modelId: "llama3.2",
    context: 8_192,
    requiresKey: false,
    description: "Roda no seu PC via Ollama (http://127.0.0.1:11434).",
    free: true,
    useConfiguredModel: true,
  },
];

export const DEFAULT_MODEL_ID = "nexus-local";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  local: "NEXUS Core (local)",
  groq: "Groq",
  google: "Google Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
};

export function getModel(id: string): ModelDef {
  return MODELS.find((model) => model.id === id) ?? MODELS[0];
}

export function findModel(id: string): ModelDef | undefined {
  return MODELS.find((model) => model.id === id);
}

export function listModels(options?: {
  hasGroq?: boolean;
  hasGoogle?: boolean;
  hasOpenRouter?: boolean;
  hasOllama?: boolean;
  capabilities?: string[];
}) {
  const has = options ?? {};
  return MODELS.filter((model) => {
    if (model.provider === "groq") return Boolean(has.hasGroq);
    if (model.provider === "google") return Boolean(has.hasGoogle);
    if (model.provider === "openrouter") return Boolean(has.hasOpenRouter);
    if (model.provider === "ollama") return Boolean(has.hasOllama);
    if (
      model.requiresCapability &&
      !has.capabilities?.includes(model.requiresCapability)
    ) {
      return false;
    }
    return true;
  });
}
