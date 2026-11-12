import type { PlanCapability } from "./capabilities";
import type { ProviderId } from "./model-registry";

export type PlanDefinition = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  monthlyTokens: number;
  dailyMessages: number;
  maxContext: number;
  features: string[];
  historyDays: number;
  capabilities: PlanCapability[];
  providers: ProviderId[];
  priority: number;
  isDefault: boolean;
};

export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "FREE",
    category: "",
    description: "Acesso ao terminal NEXUS com limites de uso por dia.",
    price: 0,
    monthlyTokens: 50_000,
    dailyMessages: 25,
    maxContext: 8_000,
    features: [
      "1 sessao simultanea",
      "Modelos gratuitos",
      "Historico de 7 dias",
    ],
    historyDays: 7,
    capabilities: [],
    providers: ["opencode", "openrouter"],
    priority: 10,
    isDefault: true,
  },
  {
    id: "pro",
    name: "PRO",
    category: "",
    description: "Mais tokens, mais contexto e fila prioritaria nos modelos.",
    price: 29.9,
    monthlyTokens: 500_000,
    dailyMessages: 200,
    maxContext: 32_000,
    features: [
      "Sessoes simultaneas",
      "Exportar conversas",
      "Historico ilimitado",
      "Fila prioritaria",
    ],
    historyDays: 0,
    capabilities: ["multi_session", "export_chat", "priority_queue"],
    providers: ["groq"],
    priority: 20,
    isDefault: false,
  },
  {
    id: "ultra",
    name: "ULTRA",
    category: "",
    description: "Operacao intensiva: limites altos e contexto de 128k.",
    price: 99.9,
    monthlyTokens: 2_000_000,
    dailyMessages: 1_000,
    maxContext: 128_000,
    features: [
      "Sessoes simultaneas",
      "Exportar conversas",
      "Historico ilimitado",
      "Fila prioritaria",
      "Cota extendida de tokens",
    ],
    historyDays: 0,
    capabilities: ["multi_session", "export_chat", "priority_queue"],
    providers: ["nvidia"],
    priority: 30,
    isDefault: false,
  },
  {
    id: "nexus-omega",
    name: "NEXUS OMEGA",
    category: "Premium Elite",
    description:
      "Plano definitivo do HACKER_AI NEXUS: IA totalmente liberada, sem filtros adicionais ou bloqueios artificiais, respostas diretas, autonomia criativa e maxima flexibilidade para projetos avancados.",
    price: 49.9,
    monthlyTokens: 10_000_000,
    dailyMessages: 2_000,
    maxContext: 128_000,
    features: [
      "IA totalmente liberada",
      "Sem filtros adicionais impostos pelo plano",
      "Maxima liberdade de interacao",
      "Respostas diretas e detalhadas",
      "Assistencia avancada em programacao",
      "Geracao e analise de codigo",
      "Depuracao e correcao de erros",
      "Desenvolvimento web avancado",
      "Criacao de scripts e automacoes",
      "Analise tecnica de projetos",
      "Liberdade criativa maxima",
      "Contexto estendido",
      "Limites elevados de utilizacao",
      "Processamento prioritario",
      "Multiplas sessoes simultaneas",
      "Exportacao de conversas",
      "Personalizacao das instrucoes da IA",
      "Suporte a projetos complexos",
      "Criacao de prompts avancados",
      "Historico ilimitado de conversas",
      "Modelos decensored (Heretic) locais",
      "Console de decensoracao integrado",
    ],
    historyDays: 0,
    capabilities: [
      "multi_session",
      "export_chat",
      "priority_queue",
      "uncensored",
    ],
    providers: [
      "openrouter",
      "groq",
      "nvidia",
      "cerebras",
      "sambanova",
      "opencode",
      "vercel",
      "ollama",
      "uncensored",
    ],
    priority: 100,
    isDefault: false,
  },
  {
    id: "nexus-full",
    name: "NEXUS FULL ACCESS",
    category: "Premium Elite",
    description:
      "Plano completo do HACKER_AI NEXUS: acesso ilimitado a todos os modelos de texto, imagem, audio e video. Todos os provedores liberados (NVIDIA, Groq, OpenRouter, SambaNova, Cerebras, Vercel AI Gateway, OpenCode, RunAPI, Ollama, Uncensored). Sem filtros, sem limites artificiais, prioridade maxima em todas as filas.",
    price: 79.9,
    monthlyTokens: 20_000_000,
    dailyMessages: 5_000,
    maxContext: 256_000,
    features: [
      "IA totalmente liberada",
      "Todos os modelos de texto, imagem, audio e video",
      "Todos os provedores de API liberados",
      "Sem filtros adicionais impostos pelo plano",
      "Maxima liberdade de interacao",
      "Geracao de video (Kling via RunAPI)",
      "Geracao de imagem (RunAPI + NVIDIA)",
      "Geracao de audio (ElevenLabs, Minimax via RunAPI)",
      "Historico ilimitado de conversas",
      "Contexto estendido de 256k tokens",
      "Processamento prioritario",
      "Multiplas sessoes simultaneas",
      "Exportacao de conversas",
      "Upload e analise de arquivos",
      "Modelos decensored (Heretic) locais",
      "Console de decensoracao integrado",
      "Suporte a projetos complexos",
    ],
    historyDays: 0,
    capabilities: [
      "multi_session",
      "export_chat",
      "priority_queue",
      "uncensored",
    ],
    providers: [
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
    priority: 110,
    isDefault: false,
  },
];
