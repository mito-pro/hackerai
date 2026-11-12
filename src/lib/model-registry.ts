import type { PlanCapability } from "./capabilities";

export type ProviderId =
  | "local"
  | "groq"
  | "google"
  | "openrouter"
  | "ollama"
  | "cerebras"
  | "sambanova"
  | "nvidia"
  | "opencode"
  | "vercel"
  | "uncensored"
  | "runapi"
  | "pollinations"
  | "streamelements"
  | "google-tts";

export type CompatibleProviderId = "cerebras" | "sambanova" | "nvidia" | "uncensored";

export type ModelType = "text" | "image" | "audio" | "video";

export type ModelDef = {
  id: string;
  label: string;
  provider: ProviderId;
  modelId: string;
  type: ModelType;
  context: number;
  requiresKey: boolean;
  description: string;
  free: boolean;
  uncensored?: boolean;
  requiresCapability?: PlanCapability;
  useConfiguredModel?: boolean;
};

export type CompatibleProvider = {
  id: CompatibleProviderId;
  label: string;
  baseUrl: string;
  envKey: string;
  hint: string;
};

export const COMPATIBLE_PROVIDERS: CompatibleProvider[] = [
  {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    hint: "cloud.cerebras.ai :: free tier",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    envKey: "NVIDIA_API_KEY",
    hint: "build.nvidia.com :: creditos gratis",
  },
];

export const PROVIDER_IDS: ProviderId[] = [
  "local",
  "openrouter",
  "groq",
  "google",
  "nvidia",
  "cerebras",
  "sambanova",
  "opencode",
  "vercel",
  "ollama",
  "uncensored",
  "runapi",
  "pollinations",
  "streamelements",
  "google-tts",
];

export const PLAN_PROVIDERS: Record<string, ProviderId[]> = {
  free: ["groq"],
  pro: ["groq"],
  ultra: ["nvidia"],
  "nexus-omega": ["groq", "nvidia", "cerebras"],
};

const ADMIN_PROVIDERS: ProviderId[] = [
  "groq",
  "nvidia",
  "cerebras",
  "google",
];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as string[]).includes(value);
}

export function normalizeProviders(
  values: readonly string[] | null | undefined,
  fallback: readonly ProviderId[] = PLAN_PROVIDERS.free
): ProviderId[] {
  const source = values?.length ? values : fallback;
  const valid = source.filter(
    (value): value is ProviderId =>
      typeof value === "string" && isProviderId(value)
  );
  return Array.from(new Set<ProviderId>(["local", ...valid]));
}

export function allowedProviders(planId: string, isAdmin = false): ProviderId[] {
  if (isAdmin) return Array.from(new Set<ProviderId>(["local", ...ADMIN_PROVIDERS]));
  return normalizeProviders(PLAN_PROVIDERS[planId], PLAN_PROVIDERS.free);
}

export function providersForPlan(
  plan: { id: string; providers?: readonly string[] | null },
  isAdmin = false
): ProviderId[] {
  if (isAdmin) return allowedProviders(plan.id, true);
  return normalizeProviders(
    plan.providers,
    PLAN_PROVIDERS[plan.id] ?? PLAN_PROVIDERS.free
  );
}

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
    type: "text",
  },
  {
    id: "groq/gpt-oss-120b",
    label: "Groq · GPT OSS 120B",
    provider: "groq",
    modelId: "openai/gpt-oss-120b",
    context: 131_072,
    requiresKey: true,
    description: "Modelo aberto da OpenAI servido pela Groq, raciocinio rapido.",
    free: true,
    type: "text",
  },
  {
    id: "groq/gpt-oss-20b",
    label: "Groq · GPT OSS 20B",
    provider: "groq",
    modelId: "openai/gpt-oss-20b",
    context: 131_072,
    requiresKey: true,
    description: "Variante leve do GPT OSS para respostas instantaneas.",
    free: true,
    type: "text",
  },
  {
    id: "groq/llama-3.3-70b-versatile",
    label: "Groq · Llama 3.3 70B Versatile",
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    context: 128_000,
    requiresKey: true,
    description: "Llama 3.3 70B da Meta com respostas de alta velocidade.",
    free: true,
    type: "text",
  },
  {
    id: "groq/llama-3.1-8b-instant",
    label: "Groq · Llama 3.1 8B Instant",
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
    context: 128_000,
    requiresKey: true,
    description: "Llama 3.1 8B, o mais rapido do lineup Groq.",
    free: true,
    type: "text",
  },
  {
    id: "groq/llama-4-scout",
    label: "Groq · Llama 4 Scout 17B",
    provider: "groq",
    modelId: "meta-llama/llama-4-scout-17b-16e-instruct",
    context: 131_072,
    requiresKey: true,
    description: "Llama 4 Scout da Meta com raciocinio multimodal.",
    free: true,
    type: "text",
  },
  {
    id: "groq/llama-4-maverick",
    label: "Groq · Llama 4 Maverick 17B",
    provider: "groq",
    modelId: "meta-llama/llama-4-maverick-17b-128e-instruct",
    context: 131_072,
    requiresKey: true,
    description: "Llama 4 Maverick da Meta, mais completo que o Scout.",
    free: true,
    type: "text",
  },
  {
    id: "groq/kimi-k2",
    label: "Groq · Kimi K2 Instruct",
    provider: "groq",
    modelId: "moonshotai/kimi-k2-instruct",
    context: 131_072,
    requiresKey: true,
    description: "Kimi K2 da Moonshot, forte em codigo e ferramentas.",
    free: true,
    type: "text",
  },
  {
    id: "groq/qwen3-32b",
    label: "Groq · Qwen3 32B",
    provider: "groq",
    modelId: "qwen/qwen3-32b",
    context: 131_072,
    requiresKey: true,
    description: "Qwen3 32B da Alibaba, excelente em multilingual.",
    free: true,
    type: "text",
  },
  {
    id: "groq/deepseek-r1-distill-70b",
    label: "Groq · DeepSeek R1 Distill 70B",
    provider: "groq",
    modelId: "deepseek-r1-distill-llama-70b",
    context: 131_072,
    requiresKey: true,
    description: "Raciocinio stepwise do DeepSeek R1 destilado em Llama 70B.",
    free: true,
    type: "text",
  },
  {
    id: "groq/gemma2-9b",
    label: "Groq · Gemma 2 9B",
    provider: "groq",
    modelId: "gemma2-9b-it",
    context: 8_192,
    requiresKey: true,
    description: "Gemma 2 9B da Google, leve e direto.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/nemotron-3-ultra",
    label: "NVIDIA · Nemotron 3 Ultra 550B",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3-ultra-550b-a55b",
    context: 1_000_000,
    requiresKey: true,
    description: "Maior modelo NVIDIA, raciocinio avançado e contexto de 1M tokens.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/nemotron-3-super",
    label: "NVIDIA · Nemotron 3 Super 120B",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3-super-120b-a12b",
    context: 131_072,
    requiresKey: true,
    description: "Nemotron 3 Super 120B da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/nemotron-nano-omni",
    label: "NVIDIA · Nemotron 3 Nano Omni 30B",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    context: 256_000,
    requiresKey: true,
    description: "Nemotron Nano Omni com raciocinio e multimodal.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/nemotron-3.5-lightning",
    label: "NVIDIA · Nemotron 3.5 Lightning 30B",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3.5-lightning-30b-a3b",
    context: 131_072,
    requiresKey: true,
    description: "Nemotron 3.5 Lightning 30B da NVIDIA, raciocinio rapido.",
    free: true,
    type: "text",
  },
  {
    id: "pollinations/flux",
    label: "Pollinations · FLUX",
    provider: "pollinations",
    modelId: "flux",
    context: 4096,
    requiresKey: false,
    description: "Imagem gratuita via Pollinations.ai com modelo FLUX. Sem chave de API.",
    free: true,
    type: "image",
  },
  {
    id: "pollinations/z-image-turbo",
    label: "Pollinations · Z-Image Turbo",
    provider: "pollinations",
    modelId: "z-image-turbo",
    context: 4096,
    requiresKey: false,
    description: "Imagem instantanea e barata via Pollinations (Alibaba Z-Image).",
    free: true,
    type: "image",
  },
  {
    id: "pollinations/turbo",
    label: "Pollinations · Turbo",
    provider: "pollinations",
    modelId: "turbo",
    context: 4096,
    requiresKey: false,
    description: "Variante rapida do Pollinations para prototipagem de imagens.",
    free: true,
    type: "image",
  },
  {
    id: "nvidia/flux-1-dev",
    label: "NVIDIA · FLUX.1 Dev",
    provider: "nvidia",
    modelId: "black-forest-labs/flux.1-dev",
    context: 4096,
    requiresKey: true,
    description: "FLUX.1 Dev da Black Forest Labs hospedado pela NVIDIA NIM.",
    free: false,
    type: "image",
  },
  {
    id: "google-tts/pt",
    label: "Google Voz · Portugues",
    provider: "google-tts",
    modelId: "pt",
    context: 8_192,
    requiresKey: false,
    description: "Texto em fala em portugues sem chave de API.",
    free: true,
    type: "audio",
  },
  {
    id: "google-tts/en",
    label: "Google Voz · Ingles",
    provider: "google-tts",
    modelId: "en",
    context: 8_192,
    requiresKey: false,
    description: "Texto em fala em ingles sem chave de API.",
    free: true,
    type: "audio",
  },
  {
    id: "google-tts/es",
    label: "Google Voz · Espanhol",
    provider: "google-tts",
    modelId: "es",
    context: 8_192,
    requiresKey: false,
    description: "Texto em fala em espanhol sem chave de API.",
    free: true,
    type: "audio",
  },
  {
    id: "pollinations/tts",
    label: "Pollinations · Voz IA",
    provider: "pollinations",
    modelId: "tts",
    context: 8_192,
    requiresKey: false,
    description: "Fala natural via Pollinations com vozes estilo OpenAI.",
    free: true,
    type: "audio",
  },
  {
    id: "streamelements/brian",
    label: "StreamElements · Voz Brian",
    provider: "streamelements",
    modelId: "brian",
    context: 8_192,
    requiresKey: false,
    description: "Fala gratuita StreamElements com voz masculina.",
    free: true,
    type: "audio",
  },
  {
    id: "nvidia/sdxl",
    label: "NVIDIA · SDXL 1.0",
    provider: "nvidia",
    modelId: "stability-ai/sdxl",
    context: 4096,
    requiresKey: true,
    description: "Stable Diffusion XL 1.0 via NVIDIA NIM para geracao de imagem.",
    free: false,
    type: "image",
  },
  {
    id: "nvidia/nemotron-3.5-super-vl",
    label: "NVIDIA · Nemotron 3.5 Super VL 120B",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    context: 131_072,
    requiresKey: true,
    description: "Nemotron 3.5 Super VL 120B visao-linguagem da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/llama-3.1-nemotron-ultra",
    label: "NVIDIA · Llama 3.1 Nemotron Ultra 253B",
    provider: "nvidia",
    modelId: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    context: 131_072,
    requiresKey: true,
    description: "Llama 3.1 Nemotron Ultra 253B da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b",
    label: "NVIDIA · Llama 3.1 Nemotron 70B",
    provider: "nvidia",
    modelId: "nvidia/llama-3.1-nemotron-70b-instruct",
    context: 131_072,
    requiresKey: true,
    description: "Llama 3.1 Nemotron 70B Instruct da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/llama-3.1-nemotron-51b",
    label: "NVIDIA · Llama 3.1 Nemotron 51B",
    provider: "nvidia",
    modelId: "nvidia/llama-3.1-nemotron-51b-instruct",
    context: 131_072,
    requiresKey: true,
    description: "Llama 3.1 Nemotron 51B Instruct da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/nemotron-4-340b",
    label: "NVIDIA · Nemotron 4 340B Instruct",
    provider: "nvidia",
    modelId: "nvidia/nemotron-4-340b-instruct",
    context: 131_072,
    requiresKey: true,
    description: "Nemotron 4 340B Instruct da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/nemotron-nano-3",
    label: "NVIDIA · Nemotron Nano 3 30B",
    provider: "nvidia",
    modelId: "nvidia/nemotron-nano-3-30b-a3b",
    context: 131_072,
    requiresKey: true,
    description: "Nemotron Nano 3 30B da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/nemotron-3.5-bolt",
    label: "NVIDIA · Nemotron 3.5 Bolt E4B",
    provider: "nvidia",
    modelId: "nvidia/nemotron-3.5-bolt-e4b",
    context: 131_072,
    requiresKey: true,
    description: "Nemotron 3.5 Bolt E4B da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/mistral-nemo-minitron",
    label: "NVIDIA · Mistral Nemo Minitron 8B",
    provider: "nvidia",
    modelId: "nvidia/mistral-nemo-minitron-8b-8k-instruct",
    context: 131_072,
    requiresKey: true,
    description: "Mistral Nemo Minitron 8B Instruct da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/llama3-chatqa",
    label: "NVIDIA · Llama3 ChatQA 1.5 70B",
    provider: "nvidia",
    modelId: "nvidia/llama3-chatqa-1.5-70b",
    context: 131_072,
    requiresKey: true,
    description: "Llama3 ChatQA 1.5 70B da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/vila",
    label: "NVIDIA · VILA (visao-linguagem)",
    provider: "nvidia",
    modelId: "nvidia/vila",
    context: 131_072,
    requiresKey: true,
    description: "VILA modelo visao-linguagem da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "nvidia/neva-22b",
    label: "NVIDIA · NEVA 22B (agente visual)",
    provider: "nvidia",
    modelId: "nvidia/neva-22b",
    context: 131_072,
    requiresKey: true,
    description: "NEVA 22B modelo agente visual da NVIDIA.",
    free: true,
    type: "text",
  },
  {
    id: "cerebras/llama-3.3-70b",
    label: "Cerebras · Llama 3.3 70B",
    provider: "cerebras",
    modelId: "llama-3.3-70b",
    context: 131_072,
    requiresKey: true,
    description: "Llama 3.3 70B servido pelo Cerebras com inferencia ultra rapida.",
    free: true,
    type: "text",
  },
  {
    id: "cerebras/llama-3.1-8b",
    label: "Cerebras · Llama 3.1 8B",
    provider: "cerebras",
    modelId: "llama-3.1-8b",
    context: 131_072,
    requiresKey: true,
    description: "Llama 3.1 8B servido pelo Cerebras.",
    free: true,
    type: "text",
  },
];

export const LOCAL_MODEL_ID = "nexus-local";
export const DEFAULT_MODEL_ID = "groq/llama-3.3-70b-versatile";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  local: "NEXUS Core (local)",
  groq: "Groq",
  google: "Google Gemini",
  cerebras: "Cerebras",
  nvidia: "NVIDIA NIM",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
  sambanova: "SambaNova",
  opencode: "OpenCode Console",
  vercel: "Vercel AI Gateway",
  uncensored: "Uncensored Local",
  runapi: "RunAPI",
  pollinations: "Pollinations (gratis)",
  streamelements: "StreamElements TTS (gratis)",
  "google-tts": "Google Voz (gratis)",
};

export function getModel(id: string): ModelDef {
  return MODELS.find((model) => model.id === id) ?? MODELS[0];
}

export function findModel(id: string): ModelDef | undefined {
  return MODELS.find((model) => model.id === id);
}

export function compatibleProvider(
  id: CompatibleProviderId
): CompatibleProvider | undefined {
  return COMPATIBLE_PROVIDERS.find((provider) => provider.id === id);
}

export function compatibleModelDef(
  providerId: CompatibleProviderId,
  modelId: string
): ModelDef {
  const provider = compatibleProvider(providerId);
  return {
    id: `${providerId}/${modelId}`,
    label: `${provider?.label ?? providerId} :: ${modelId}`,
    provider: providerId,
    modelId,
    context: 32_768,
    requiresKey: true,
    description: `Modelo ${modelId} servido pelo ${provider?.label ?? providerId}.`,
    free: true,
    type: "text",
  };
}

export function findCompatibleModel(id: string): ModelDef | null {
  const separator = id.indexOf("/");
  if (separator <= 0) return null;
  const providerId = id.slice(0, separator) as CompatibleProviderId;
  if (!compatibleProvider(providerId)) return null;
  const modelId = id.slice(separator + 1).trim();
  if (!modelId) return null;
  return compatibleModelDef(providerId, modelId);
}

export const DEFAULT_PRIORITY: ProviderId[] = [
  "groq",
  "nvidia",
  "cerebras",
  "local",
];

export function defaultModelFor(
  availability: Partial<Record<ProviderId, boolean>>,
  planId?: string,
  providers?: readonly ProviderId[]
) {
  const allowed = providers
    ? Array.from(new Set<ProviderId>(["local", ...providers]))
    : planId
      ? allowedProviders(planId)
      : DEFAULT_PRIORITY;
  for (const provider of DEFAULT_PRIORITY) {
    if (!allowed.includes(provider)) continue;
    if (provider === "local") return LOCAL_MODEL_ID;
    if (!availability[provider]) continue;
    const model = MODELS.find((item) => item.provider === provider);
    if (model) return model.id;
  }
  return LOCAL_MODEL_ID;
}

export function pickDefaultModelId(models: ModelDef[]) {
  for (const provider of DEFAULT_PRIORITY) {
    const found = models.find((model) => model.provider === provider);
    if (found) return found.id;
  }
  return LOCAL_MODEL_ID;
}

export function listModels(options?: {
  hasGroq?: boolean;
  hasGoogle?: boolean;
  hasOpenRouter?: boolean;
  hasOllama?: boolean;
  hasNvidia?: boolean;
  hasOpenCode?: boolean;
  hasVercel?: boolean;
  hasRunapi?: boolean;
  hasCerebras?: boolean;
  capabilities?: string[];
  type?: ModelType;
  providers?: ProviderId[];
}) {
  const has = options ?? {};
  return MODELS.filter((model) => {
    if (has.providers && !has.providers.includes(model.provider)) return false;
    if (model.provider === "groq") return Boolean(has.hasGroq);
    if (model.provider === "nvidia") return Boolean(has.hasNvidia);
    if (model.provider === "cerebras") return Boolean(has.hasCerebras);
    if (model.provider === "google") return Boolean(has.hasGoogle);
    if (model.provider === "openrouter") return Boolean(has.hasOpenRouter);
    if (model.provider === "ollama") return Boolean(has.hasOllama);
    if (model.provider === "opencode") return Boolean(has.hasOpenCode);
    if (model.provider === "vercel") return Boolean(has.hasVercel);
    if (model.provider === "runapi") return Boolean(has.hasRunapi);
    if (has.type && model.type !== has.type) return false;
    return true;
  });
}

export function isModelAllowedForPlan(
  model: ModelDef,
  planId: string,
  isAdmin = false,
  capabilities: string[] = [],
  providers?: readonly ProviderId[]
) {
  if (isAdmin) return true;
  if (model.provider === "local") return true;
  const allowed = providers
    ? Array.from(new Set<ProviderId>(["local", ...providers]))
    : allowedProviders(planId);
  return allowed.includes(model.provider);
}

export function planLabel(
  planId: string,
  providers?: readonly ProviderId[]
): string {
  const list = (
    providers
      ? Array.from(new Set<ProviderId>(["local", ...providers]))
      : allowedProviders(planId)
  ).filter((provider) => provider !== "local");
  if (!list.length) return "NEXUS Core (local)";
  return list.map((provider) => PROVIDER_LABELS[provider]).join(" + ");
}
