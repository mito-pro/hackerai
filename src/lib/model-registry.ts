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
  | "runapi";

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
    id: "sambanova",
    label: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    envKey: "SAMBANOVA_API_KEY",
    hint: "sambanova.ai :: developer tier",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    envKey: "NVIDIA_API_KEY",
    hint: "build.nvidia.com :: creditos gratis",
  },
  {
    id: "uncensored",
    label: "Uncensored Local",
    baseUrl: "http://127.0.0.1:4891/v1",
    envKey: "UNCENSORED_API_KEY",
    hint: "Uncensored-Local-AI :: rode localmente",
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
];

export const PLAN_PROVIDERS: Record<string, ProviderId[]> = {
  free: ["opencode", "openrouter"],
  pro: ["groq"],
  ultra: ["nvidia"],
  "nexus-omega": [
    "openrouter",
    "groq",
    "nvidia",
    "cerebras",
    "sambanova",
    "opencode",
    "vercel",
    "ollama",
    "uncensored",
    "runapi",
  ],
};

const ADMIN_PROVIDERS: ProviderId[] = [
  "openrouter",
  "groq",
  "nvidia",
  "cerebras",
  "sambanova",
  "opencode",
    "vercel",
    "ollama",
    "google",
    "runapi",
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
    id: "openrouter/free-router",
    label: "OpenRouter · Roteador Free",
    provider: "openrouter",
    modelId: "openrouter/free",
    context: 200_000,
    requiresKey: true,
    description: "OpenRouter escolhe automaticamente um modelo free disponivel.",
    free: true,
    type: "text",
  },
  {
    id: "openrouter/auto",
    label: "OpenRouter · Roteador Auto",
    provider: "openrouter",
    modelId: "openrouter/auto",
    context: 200_000,
    requiresKey: true,
    description: "OpenRouter escolhe o melhor modelo conforme o custo e a latencia.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/big-pickle",
    label: "OpenCode · Big Pickle",
    provider: "opencode",
    modelId: "big-pickle",
    context: 200_000,
    requiresKey: true,
    description: "Modelo gratuito do OpenCode Console, raciocinio rapido.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/glm-5.3-flash-free",
    label: "OpenCode · GLM 5.3 Flash Free",
    provider: "opencode",
    modelId: "glm-5.3-flash-free",
    context: 200_000,
    requiresKey: true,
    description: "GLM 5.3 Flash em tier gratuito do OpenCode.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/deepseek-v4.1-flash-free",
    label: "OpenCode · DeepSeek V4.1 Flash Free",
    provider: "opencode",
    modelId: "deepseek-v4.1-flash-free",
    context: 200_000,
    requiresKey: true,
    description: "DeepSeek V4.1 Flash em tier gratuito do OpenCode.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/mimo-v2.6-flash-free",
    label: "OpenCode · MiMo V2.6 Flash Free",
    provider: "opencode",
    modelId: "mimo-v2.6-flash-free",
    context: 200_000,
    requiresKey: true,
    description: "MiMo V2.6 Flash em tier gratuito do OpenCode.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/minimax-m3.1-flash-free",
    label: "OpenCode · MiniMax M3.1 Flash Free",
    provider: "opencode",
    modelId: "minimax-m3.1-flash-free",
    context: 1_000_000,
    requiresKey: true,
    description: "MiniMax M3.1 Flash gratuito com 1M de contexto.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/nemotron-3.5-lightning-free",
    label: "OpenCode · Nemotron 3.5 Lightning Free",
    provider: "opencode",
    modelId: "nemotron-3.5-lightning-free",
    context: 262_144,
    requiresKey: true,
    description: "Nemotron 3.5 Lightning da NVIDIA em tier gratuito.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/nemotron-3.5-super-vl-free",
    label: "OpenCode · Nemotron 3.5 Super VL Free",
    provider: "opencode",
    modelId: "nemotron-3.5-super-vl-free",
    context: 1_048_576,
    requiresKey: true,
    description: "Nemotron 3.5 Super VL, visao-linguagem gratuita.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/inkling-2-small-free",
    label: "OpenCode · Inkling 2 Small Free",
    provider: "opencode",
    modelId: "inkling-2-small-free",
    context: 1_048_576,
    requiresKey: true,
    description: "Inkling 2 Small com 1M de contexto, custo zero.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/beam-free",
    label: "OpenCode · Beam Free",
    provider: "opencode",
    modelId: "beam-free",
    context: 1_048_576,
    requiresKey: true,
    description: "Beam, modelo aberto com 1M de contexto.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/longcat-2.5-free",
    label: "OpenCode · LongCat 2.5 Free",
    provider: "opencode",
    modelId: "longcat-2.5-free",
    context: 1_000_000,
    requiresKey: true,
    description: "LongCat 2.5 com 1M de contexto e tier gratuito.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/iceman-free",
    label: "OpenCode · Iceman Free",
    provider: "opencode",
    modelId: "iceman-free",
    context: 262_144,
    requiresKey: true,
    description: "Iceman, raciocinio estendido em tier gratuito.",
    free: true,
    type: "text",
  },
  {
    id: "opencode/flint-40b-free",
    label: "OpenCode · Flint 40B Free",
    provider: "opencode",
    modelId: "flint-40b-free",
    context: 262_144,
    requiresKey: true,
    description: "Flint 40B, modelo aberto compacto e gratuito.",
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
    description: "Maior modelo NVIDIA, raciocínio avançado e contexto de 1M tokens.",
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
    description: "Nemotron Nano Omni com raciocínio e multimodal.",
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
    description: "Nemotron 3.5 Lightning 30B da NVIDIA, raciocínio rápido.",
    free: true,
    type: "text",
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
    description: "Nemotron 3.5 Super VL 120B visão-linguagem da NVIDIA.",
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
    label: "NVIDIA · VILA (visão-linguagem)",
    provider: "nvidia",
    modelId: "nvidia/vila",
    context: 131_072,
    requiresKey: true,
    description: "VILA modelo visão-linguagem da NVIDIA.",
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
    id: "vercel/anthropic-claude-sonnet-5.5",
    label: "Vercel AI Gateway · Claude Sonnet 5.5",
    provider: "vercel",
    modelId: "anthropic/claude-sonnet-5.5",
    context: 200_000,
    requiresKey: true,
    description: "Claude Sonnet 5.5 da Anthropic via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/anthropic-claude-opus-5.5",
    label: "Vercel AI Gateway · Claude Opus 5.5",
    provider: "vercel",
    modelId: "anthropic/claude-opus-5.5",
    context: 200_000,
    requiresKey: true,
    description: "Claude Opus 5.5 da Anthropic via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/anthropic-claude-haiku-4.5",
    label: "Vercel AI Gateway · Claude Haiku 4.5",
    provider: "vercel",
    modelId: "anthropic/claude-haiku-4.5",
    context: 200_000,
    requiresKey: true,
    description: "Claude Haiku 4.5, resposta rapida via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/openai-gpt-5.5",
    label: "Vercel AI Gateway · GPT 5.5",
    provider: "vercel",
    modelId: "openai/gpt-5.5",
    context: 400_000,
    requiresKey: true,
    description: "GPT 5.5 da OpenAI via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/openai-gpt-5.4",
    label: "Vercel AI Gateway · GPT 5.4",
    provider: "vercel",
    modelId: "openai/gpt-5.4",
    context: 400_000,
    requiresKey: true,
    description: "GPT 5.4 da OpenAI via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/openai-gpt-5.4-mini",
    label: "Vercel AI Gateway · GPT 5.4 Mini",
    provider: "vercel",
    modelId: "openai/gpt-5.4-mini",
    context: 400_000,
    requiresKey: true,
    description: "GPT 5.4 Mini, custo reduzido via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/openai-gpt-oss-120b",
    label: "Vercel AI Gateway · GPT OSS 120B",
    provider: "vercel",
    modelId: "openai/gpt-oss-120b",
    context: 131_072,
    requiresKey: true,
    description: "GPT OSS 120B aberto servido pelo AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/google-gemini-3.8-flash",
    label: "Vercel AI Gateway · Gemini 3.8 Flash",
    provider: "vercel",
    modelId: "google/gemini-3.8-flash",
    context: 1_000_000,
    requiresKey: true,
    description: "Gemini 3.8 Flash com 1M de contexto via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/google-gemini-3.7-flash",
    label: "Vercel AI Gateway · Gemini 3.7 Flash",
    provider: "vercel",
    modelId: "google/gemini-3.7-flash",
    context: 1_000_000,
    requiresKey: true,
    description: "Gemini 3.7 Flash com 1M de contexto via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/google-gemini-3.1-pro-preview",
    label: "Vercel AI Gateway · Gemini 3.1 Pro",
    provider: "vercel",
    modelId: "google/gemini-3.1-pro-preview",
    context: 1_000_000,
    requiresKey: true,
    description: "Gemini 3.1 Pro via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/spacexai-grok-4.7",
    label: "Vercel AI Gateway · Grok 4.7",
    provider: "vercel",
    modelId: "spacexai/grok-4.7",
    context: 256_000,
    requiresKey: true,
    description: "Grok 4.7 da xAI via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/spacexai-grok-4.3",
    label: "Vercel AI Gateway · Grok 4.3",
    provider: "vercel",
    modelId: "spacexai/grok-4.3",
    context: 131_072,
    requiresKey: true,
    description: "Grok 4.3 da xAI via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/moonshotai-kimi-k3.1-pro",
    label: "Vercel AI Gateway · Kimi K3.1 Pro",
    provider: "vercel",
    modelId: "moonshotai/kimi-k3.1-pro",
    context: 256_000,
    requiresKey: true,
    description: "Kimi K3.1 Pro da Moonshot via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/moonshotai-kimi-k2.7-code",
    label: "Vercel AI Gateway · Kimi K2.7 Code",
    provider: "vercel",
    modelId: "moonshotai/kimi-k2.7-code",
    context: 256_000,
    requiresKey: true,
    description: "Kimi K2.7 Code, forte em programacao via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/zai-glm-5.3",
    label: "Vercel AI Gateway · GLM 5.3",
    provider: "vercel",
    modelId: "zai/glm-5.3",
    context: 200_000,
    requiresKey: true,
    description: "GLM 5.3 da Zhipu via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/zai-glm-5.3-flash",
    label: "Vercel AI Gateway · GLM 5.3 Flash",
    provider: "vercel",
    modelId: "zai/glm-5.3-flash",
    context: 200_000,
    requiresKey: true,
    description: "GLM 5.3 Flash da Zhipu via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/xiaomi-mimo-v2.6-flash",
    label: "Vercel AI Gateway · MiMo V2.6 Flash",
    provider: "vercel",
    modelId: "xiaomi/mimo-v2.6-flash",
    context: 256_000,
    requiresKey: true,
    description: "MiMo V2.6 Flash da Xiaomi via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/minimax-minimax-m3.1-flash",
    label: "Vercel AI Gateway · MiniMax M3.1 Flash",
    provider: "vercel",
    modelId: "minimax/minimax-m3.1-flash",
    context: 1_000_000,
    requiresKey: true,
    description: "MiniMax M3.1 Flash com 1M de contexto via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/deepseek-deepseek-v4-pro",
    label: "Vercel AI Gateway · DeepSeek V4 Pro",
    provider: "vercel",
    modelId: "deepseek/deepseek-v4-pro",
    context: 128_000,
    requiresKey: true,
    description: "DeepSeek V4 Pro via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/deepseek-deepseek-v4.1-flash",
    label: "Vercel AI Gateway · DeepSeek V4.1 Flash",
    provider: "vercel",
    modelId: "deepseek/deepseek-v4.1-flash",
    context: 128_000,
    requiresKey: true,
    description: "DeepSeek V4.1 Flash via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/alibaba-qwen3.7-max",
    label: "Vercel AI Gateway · Qwen 3.7 Max",
    provider: "vercel",
    modelId: "alibaba/qwen3.7-max",
    context: 256_000,
    requiresKey: true,
    description: "Qwen 3.7 Max da Alibaba via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/alibaba-qwen3-coder-next",
    label: "Vercel AI Gateway · Qwen3 Coder Next",
    provider: "vercel",
    modelId: "alibaba/qwen3-coder-next",
    context: 256_000,
    requiresKey: true,
    description: "Qwen3 Coder Next, foco em codigo via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/meta-llama-4-maverick",
    label: "Vercel AI Gateway · Llama 4 Maverick",
    provider: "vercel",
    modelId: "meta/llama-4-maverick",
    context: 131_072,
    requiresKey: true,
    description: "Llama 4 Maverick da Meta via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/mistral-mistral-large-4",
    label: "Vercel AI Gateway · Mistral Large 4",
    provider: "vercel",
    modelId: "mistral/mistral-large-4",
    context: 131_072,
    requiresKey: true,
    description: "Mistral Large 4 via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/nvidia-nemotron-3-ultra-550b-a55b",
    label: "Vercel AI Gateway · Nemotron 3 Ultra 550B",
    provider: "vercel",
    modelId: "nvidia/nemotron-3-ultra-550b-a55b",
    context: 1_000_000,
    requiresKey: true,
    description: "Nemotron 3 Ultra 550B da NVIDIA via AI Gateway.",
    free: false,
    type: "text",
  },
  {
    id: "vercel/nvidia-nemotron-3.5-lightning-free",
    label: "Vercel AI Gateway · Nemotron 3.5 Lightning Free",
    provider: "vercel",
    modelId: "nvidia/nemotron-3.5-lightning-free",
    context: 262_144,
    requiresKey: true,
    description: "Nemotron 3.5 Lightning gratuito via AI Gateway.",
    free: true,
    type: "text",
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
    type: "text",
    useConfiguredModel: true,
  },
  {
    id: "uncensored/gemma-2-2b",
    label: "Uncensored :: Gemma 2 2B",
    provider: "uncensored",
    modelId: "local",
    context: 8_192,
    requiresKey: false,
    description: "Gemma 2 2B — rapido, ideal para PCs e phones com pouca RAM.",
    free: true,
    type: "text",
    uncensored: true,
    requiresCapability: "uncensored",
  },
  {
    id: "uncensored/gemma-4-e4b-heretic",
    label: "Uncensored :: Gemma 4 E4B Heretic",
    provider: "uncensored",
    modelId: "local",
    context: 32_768,
    requiresKey: false,
    description: "Gemma 4 E4B Heretic — alta qualidade, totalmente sem censura.",
    free: true,
    type: "text",
    uncensored: true,
    requiresCapability: "uncensored",
  },
  {
    id: "runapi/kling-v2.1-standard",
    label: "RunAPI · Kling v2.1 Standard",
    provider: "runapi",
    modelId: "kling-v2.1-standard",
    context: 4096,
    requiresKey: true,
    description: "Kling v2.1 Standard — texto/imagem para video pela Kuaishou via RunAPI.",
    free: false,
    type: "video",
  },
  {
    id: "runapi/kling-v2.1-pro",
    label: "RunAPI · Kling v2.1 Pro",
    provider: "runapi",
    modelId: "kling-v2.1-pro",
    context: 4096,
    requiresKey: true,
    description: "Kling v2.1 Pro — video de alta qualidade com controle de camera e movimento.",
    free: false,
    type: "video",
  },
  {
    id: "runapi/kling-v3-turbo-text-to-video",
    label: "RunAPI · Kling v3 Turbo Text-to-Video",
    provider: "runapi",
    modelId: "kling-v3-turbo-text-to-video",
    context: 4096,
    requiresKey: true,
    description: "Kling v3 Turbo — texto para video rapido, 720p/1080p, 3-15 segundos.",
    free: false,
    type: "video",
  },
  {
    id: "runapi/kling-v3-turbo-image-to-video",
    label: "RunAPI · Kling v3 Turbo Image-to-Video",
    provider: "runapi",
    modelId: "kling-v3-turbo-image-to-video",
    context: 4096,
    requiresKey: true,
    description: "Kling v3 Turbo — anima imagem para video com prompt de movimento opcional.",
    free: false,
    type: "video",
  },
  {
    id: "runapi/kling-v2.6",
    label: "RunAPI · Kling v2.6",
    provider: "runapi",
    modelId: "kling-v2.6",
    context: 4096,
    requiresKey: true,
    description: "Kling v2.6 — video generation pela Kuaishou via RunAPI.",
    free: false,
    type: "video",
  },
  {
    id: "runapi/minimax-audio",
    label: "RunAPI · Minimax Audio",
    provider: "runapi",
    modelId: "minimax-audio",
    context: 4096,
    requiresKey: true,
    description: "Minimax Audio — texto para fala com vozes realistas via RunAPI.",
    free: false,
    type: "audio",
  },
  {
    id: "runapi/elevenlabs-v2",
    label: "RunAPI · ElevenLabs v2",
    provider: "runapi",
    modelId: "elevenlabs-v2",
    context: 4096,
    requiresKey: true,
    description: "ElevenLabs v2 — sintese de fala de alta fidelidade via RunAPI.",
    free: false,
    type: "audio",
  },
  {
    id: "runapi/gpt-image-2",
    label: "RunAPI · GPT Image 2",
    provider: "runapi",
    modelId: "gpt-image-2",
    context: 4096,
    requiresKey: true,
    description: "GPT Image 2 da OpenAI — texto para imagem com renderizacao de texto multilingue.",
    free: false,
    type: "image",
  },
  {
    id: "runapi/nano-banana",
    label: "RunAPI · Nano Banana",
    provider: "runapi",
    modelId: "nano-banana",
    context: 4096,
    requiresKey: true,
    description: "Nano Banana do Google — imagem rapida com texto preciso e consistencia de personagens.",
    free: false,
    type: "image",
  },
  {
    id: "runapi/nano-banana-pro",
    label: "RunAPI · Nano Banana Pro",
    provider: "runapi",
    modelId: "nano-banana-pro",
    context: 4096,
    requiresKey: true,
    description: "Nano Banana Pro do Google — imagem ate 4K com melhor renderizacao de texto.",
    free: false,
    type: "image",
  },
];

export const LOCAL_MODEL_ID = "nexus-local";
export const DEFAULT_MODEL_ID = "openrouter/free-router";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  local: "NEXUS Core (local)",
  groq: "Groq",
  google: "Google Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
  cerebras: "Cerebras",
  sambanova: "SambaNova",
  nvidia: "NVIDIA NIM",
  opencode: "OpenCode Console",
  vercel: "Vercel AI Gateway",
  uncensored: "Uncensored Local",
  runapi: "RunAPI",
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
    requiresKey: providerId !== "uncensored",
    description: `Modelo ${modelId} servido pelo ${provider?.label ?? providerId}.`,
    free: true,
    type: "text",
    uncensored: providerId === "uncensored",
    requiresCapability: providerId === "uncensored" ? "uncensored" : undefined,
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
  "google",
  "opencode",
  "openrouter",
  "cerebras",
  "sambanova",
  "vercel",
  "ollama",
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
  capabilities?: string[];
  type?: ModelType;
  providers?: ProviderId[];
}) {
  const has = options ?? {};
  return MODELS.filter((model) => {
    if (has.providers && !has.providers.includes(model.provider)) return false;
    if (model.provider === "groq") return Boolean(has.hasGroq);
    if (model.provider === "google") return Boolean(has.hasGoogle);
    if (model.provider === "openrouter") return Boolean(has.hasOpenRouter);
    if (model.provider === "ollama") {
      if (model.uncensored && has.capabilities?.includes("uncensored")) return true;
      return Boolean(has.hasOllama);
    }
    if (model.provider === "nvidia") return Boolean(has.hasNvidia);
    if (model.provider === "opencode") return Boolean(has.hasOpenCode);
    if (model.provider === "vercel") return Boolean(has.hasVercel);
    if (model.provider === "runapi") return Boolean(has.hasRunapi);
    if (model.provider === "uncensored") {
      return Boolean(has.capabilities?.includes("uncensored"));
    }
    if (
      model.requiresCapability &&
      !has.capabilities?.includes(model.requiresCapability)
    ) {
      return false;
    }
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
  if (model.uncensored || model.requiresCapability) {
    return capabilities.includes(model.requiresCapability ?? "uncensored");
  }
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
