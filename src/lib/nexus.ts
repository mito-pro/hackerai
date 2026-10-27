import { formatNumber } from "./utils";

export type NexusContext = {
  planName: string;
  tokensUsed: number;
  tokenLimit: number;
  messagesToday: number;
  dailyLimit: number;
  modelsOnline: number;
  userName: string;
  canExport?: boolean;
  historyDays?: number;
  maxContext?: number;
  canUncensored?: boolean;
  omegaModels?: number;
};

const COMMANDS = [
  "/help - lista os comandos do terminal",
  "/status - mostra plano, tokens e sessao",
  "/plan - detalhes do plano atual",
  "/tokens - consumo de tokens do ciclo",
  "/modelos - provedores e modelos disponiveis",
  "/omega - modo sem censura (modelos Heretic locais)",
  "/limites - regras de cota, contexto e retencao",
  "/exportar - como baixar uma conversa",
  "/api - como conectar APIs gratuitas",
];

const CODE_TEMPLATES: Record<
  string,
  { label: string; code: string }
> = {
  bash: {
    label: "bash",
    code: `#!/usr/bin/env bash
set -euo pipefail

# lista portas em escuta com o processo dono
ss -tulpn | sed -n '1,20p'

# verifica se uma porta responde
if nc -z 127.0.0.1 3000; then
  echo "servico ativo na 3000"
else
  echo "porta 3000 fechada"
fi`,
  },
  python: {
    label: "python",
    code: `import re

def validar_otp(codigo: str) -> bool:
    """Valida um OTP de 6 digitos."""
    return bool(re.fullmatch(r"\\d{6}", codigo or ""))

if __name__ == "__main__":
    print(validar_otp("123456"))  # True`,
  },
  typescript: {
    label: "typescript",
    code: `export function validarOtp(codigo: string): boolean {
  return /^\\d{6}$/.test(codigo.trim());
}

const tentativas = new Map<string, number>();

export function registrarTentativa(chave: string, limite = 5): boolean {
  const total = (tentativas.get(chave) ?? 0) + 1;
  tentativas.set(chave, total);
  return total <= limite;
}`,
  },
  sql: {
    label: "sql",
    code: `SELECT
  u.email,
  COUNT(l.id) AS requisicoes,
  COALESCE(SUM(l.total_tokens), 0) AS tokens
FROM users u
LEFT JOIN usage_logs l ON l.user_id = u.id
GROUP BY u.id
ORDER BY tokens DESC
LIMIT 10;`,
  },
  docker: {
    label: "docker",
    code: `services:
  nexus:
    build: .
    ports:
      - "3000:3000"
    environment:
      APP_SECRET: \${APP_SECRET}
      DATABASE_PATH: ./data/hackerai.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped`,
  },
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectLanguage(text: string) {
  const lower = normalize(text);
  if (/\b(bash|shell|sh|zsh)\b/.test(lower)) return "bash";
  if (/\b(python|py)\b/.test(lower)) return "python";
  if (/\b(sql|consulta|query)\b/.test(lower)) return "sql";
  if (/\b(docker|dockerfile|compose)\b/.test(lower)) return "docker";
  if (/\b(ts|typescript|javascript|js|node|react|next)\b/.test(lower)) {
    return "typescript";
  }
  return "typescript";
}

function codeReply(text: string, context: NexusContext) {
  const key = detectLanguage(text);
  const template = CODE_TEMPLATES[key];
  const used = context.modelsOnline > 1;

  return [
    `NEXUS CORE :: modelo local em ${template.label}`,
    "",
    "Sem provedor externo conecto, isto e um esqueleto pronto para adaptar:",
    "",
    "```" + template.label,
    template.code,
    "```",
    "",
    used
      ? "Voce tem provedores online: troque o modelo no seletor para uma geracao completa."
      : "Conecte uma chave gratuita em Admin > Provedores para gerar a solucao final.",
  ].join("\n");
}

function securityReply(text: string) {
  return [
    "NEXUS CORE :: roteiro de seguranca",
    "",
    "Checklist minimo para o cenario descrito:",
    "  1. entrada sempre validada no servidor (schema), nunca so no front.",
    "  2. segredos em variavel de ambiente ou cofre AES-256-GCM (nunca no repo).",
    "  3. autorizacao por papel verificada em cada rota, nao so na interface.",
    "  4. limite de tentativas + bloqueio progressivo em login/OTP.",
    "  5. registros de auditoria para mudancas sensiveis.",
    "  6. superficie minima: rate limit, CSP, cookies httpOnly e SameSite.",
    "",
    `Pergunta recebida: "${text.slice(0, 140)}${text.length > 140 ? "..." : ""}"`,
    "",
    "Com um provedor online o mesmo roteiro vira uma analise completa do seu codigo.",
  ].join("\n");
}

function howToReply(text: string) {
  const lower = normalize(text);
  const steps: string[] = [];

  if (lower.includes("api") || lower.includes("chave") || lower.includes("key")) {
    steps.push(
      "Admin > Provedores: cole a chave (Groq, Google AI Studio ou OpenRouter).",
      "A chave e criptografada com AES-256-GCM antes de ir para o banco.",
      "Salve e escolha o modelo correspondente no seletor do chat."
    );
  } else if (lower.includes("smtp") || lower.includes("email") || lower.includes("otp")) {
    steps.push(
      "Admin > Provedores: preencha host, porta, usuario, senha e remetente.",
      "Clique em salvar configuracoes e depois em testar conexao.",
      "Sem SMTP o codigo aparece no console do servidor (modo dev)."
    );
  } else if (lower.includes("plano") || lower.includes("preco") || lower.includes("assinatura")) {
    steps.push(
      "Admin > Planos: ajuste cota mensal, limite diario e contexto.",
      "Admin > Usuarios: troque o plano do operador.",
      "O preco e informativo: nao existe cobranca automatica nesta versao."
    );
  } else {
    steps.push(
      "Descreva o objetivo em uma frase (stack, linguagem e resultado esperado).",
      "Se for codigo, diga a linguagem e o formato do arquivo.",
      "Com um provedor online a resposta vem completa e executavel."
    );
  }

  return [
    "NEXUS CORE :: roteiro sugerido",
    "",
    ...steps.map((step, index) => `  ${index + 1}. ${step}`),
    "",
    `Pedido: "${text.slice(0, 140)}${text.length > 140 ? "..." : ""}"`,
    "",
    "Para respostas completas conecte um provedor gratuito em Admin > Provedores.",
  ].join("\n");
}

export function nexusReply(prompt: string, context: NexusContext): string {
  const text = prompt.trim();
  const lower = normalize(text);

  if (lower === "/help" || lower === "ajuda" || lower.startsWith("help")) {
    return [
      "NEXUS CORE :: comandos disponiveis",
      "",
      ...COMMANDS.map((line) => `  ${line}`),
      "",
      "Este motor roda 100% offline na sua maquina. Conecte um provedor gratuito no painel admin para respostas de LLMs reais.",
    ].join("\n");
  }

  if (lower === "/status") {
    return [
      "NEXUS CORE :: status da sessao",
      `  operador   : ${context.userName}`,
      `  plano      : ${context.planName}`,
      `  tokens     : ${formatNumber(context.tokensUsed)} / ${formatNumber(context.tokenLimit)}`,
      `  mensagens  : ${context.messagesToday} / ${context.dailyLimit} hoje`,
      `  provedores : ${context.modelsOnline} modelo(s) online`,
    ].join("\n");
  }

  if (lower === "/plan" || lower.includes("meu plano")) {
    const lines = [
      `Plano ${context.planName} ativo.`,
      `Cota: ${formatNumber(context.tokenLimit)} tokens por ciclo mensal.`,
      `Mensagens: ${context.messagesToday}/${context.dailyLimit} por dia.`,
    ];
    if (context.historyDays) {
      lines.push(`Historico retido por ${context.historyDays} dias.`);
    }
    if (context.canExport) {
      lines.push("Exportacao de conversas: liberada (/exportar).");
    }
    lines.push("Troque de plano no painel admin -> Planos.");
    return lines.join("\n");
  }

  if (lower === "/tokens" || lower.includes("quanto token")) {
    return [
      `Consumo do ciclo: ${formatNumber(context.tokensUsed)} de ${formatNumber(context.tokenLimit)} tokens.`,
      `Uso: ${context.tokenLimit ? ((context.tokensUsed / context.tokenLimit) * 100).toFixed(1) : "0"}%.`,
      "Tokens = entrada (prompt) + saida (resposta). O contador reinicia no primeiro dia do mes (UTC).",
    ].join("\n");
  }

  if (lower === "/limites" || lower.includes("limite") || lower.includes("cota")) {
    return [
      "NEXUS CORE :: limites aplicados",
      `  tokens/mes ....... ${formatNumber(context.tokenLimit)}`,
      `  mensagens/dia ... ${context.dailyLimit}`,
      `  contexto ........ ${formatNumber(context.maxContext ?? 0)} tokens por requisicao`,
      `  historico ....... ${context.historyDays ? `${context.historyDays} dias` : "ilimitado"}`,
      `  exportacao ...... ${context.canExport ? "liberada" : "nao inclusa no plano"}`,
      "",
      "Mensagens acima da cota sao barradas com HTTP 429/402 pelo servidor.",
    ].join("\n");
  }

  if (lower === "/omega" || lower.includes("sem censura") || lower.includes("uncensored")) {
    if (!context.canUncensored) {
      return [
        "NEXUS CORE :: modo sem censura",
        "",
        "O modo sem censura usa modelos locais decensored (Heretic) e fica no plano NEXUS OMEGA.",
        "O admin pode liberar o recurso trocando seu plano em Admin > Usuarios.",
        "Depois, escolha o modelo OMEGA no seletor do topo do terminal.",
      ].join("\n");
    }
    return [
      "NEXUS OMEGA :: modo sem censura",
      `  modelos OMEGA : ${context.omegaModels ?? 0} disponivel(is) no Ollama`,
      "  origem       : pesos locais decensored pelo Heretic (0xSojalSec/Uncensored-AI)",
      "",
      "Selecione um modelo OMEGA no seletor do topo para conversar.",
      "O console de decensoracao fica em Admin > Omega.",
    ].join("\n");
  }

  if (lower === "/modelos" || lower.includes("quais modelos")) {
    return [
      "Modelos registrados no NEXUS:",
      "  NEXUS Core (local, offline)",
      "  Groq Llama 3.3 70B / 3.1 8B (free)",
      "  Google Gemini Flash (free)",
      "  OpenRouter DeepSeek + Llama 3.3 (free)",
      "  Ollama (modelo local do seu PC)",
      ...(context.canUncensored
        ? [`  OMEGA (${context.omegaModels ?? 0} modelo(s) decensored local(is))`]
        : []),
      "",
      "As chaves sao cadastradas em Admin > Provedores e ficam criptografadas no banco.",
    ].join("\n");
  }

  if (lower === "/exportar" || lower.includes("exportar")) {
    if (!context.canExport) {
      return [
        "Exportacao de conversas nao esta inclusa no plano atual.",
        "Planos com o recurso: PRO e ULTRA (Admin > Planos).",
        "O admin pode liberar o recurso trocando seu plano.",
      ].join("\n");
    }
    return [
      "Exportacao liberada.",
      "Na barra lateral, use o botao de download ao lado de cada sessao.",
      "O arquivo gerado e um Markdown com o transcript completo (operador + NEXUS).",
    ].join("\n");
  }

  if (lower === "/api" || lower.includes("api gratis") || lower.includes("api gratuita")) {
    return [
      "Como usar APIs gratuitas:",
      "  1. Groq: console.groq.com -> criar API key (free).",
      "  2. Google AI Studio: aistudio.google.com -> Get API key (free).",
      "  3. OpenRouter: openrouter.ai/keys -> key + modelos :free.",
      "  4. Ollama: instale e rode `ollama serve` (100% offline).",
      "Depois cole as chaves em Admin > Provedores e escolha o modelo no seletor do chat.",
    ].join("\n");
  }

  if (/^(oi|ol[aá]|opa|e a[eé]|hey|hello|bom dia|boa tarde|boa noite)\b/.test(lower)) {
    return [
      `Ola, ${context.userName}. NEXUS Core online.`,
      "Escreva /help para ver os comandos ou faca uma pergunta direta.",
      "Para respostas completas de LLM, conecte uma API gratuita no painel admin.",
    ].join("\n");
  }

  if (
    lower.includes("codigo") ||
    lower.includes("code") ||
    lower.includes("funcao") ||
    lower.includes("script") ||
    lower.includes("implemente") ||
    lower.includes("programa")
  ) {
    return codeReply(text, context);
  }

  if (
    lower.includes("seguranca") ||
    lower.includes("vulnerabilidade") ||
    lower.includes("pentest") ||
    lower.includes("exploit") ||
    lower.includes("ataque") ||
    lower.includes("sql injection") ||
    lower.includes("xss")
  ) {
    return securityReply(text);
  }

  if (lower.includes("token")) {
    return [
      "Tokens sao a unidade de consumo dos modelos de linguagem.",
      "Entrada (prompt) + saida (resposta) = tokens contabilizados.",
      `Seu ciclo: ${formatNumber(context.tokensUsed)}/${formatNumber(context.tokenLimit)} tokens.`,
    ].join("\n");
  }

  if (
    lower.includes("como ") ||
    lower.includes("como faco") ||
    lower.includes("onde ") ||
    lower.includes("passo a passo")
  ) {
    return howToReply(text);
  }

  return [
    "NEXUS Core respondeu (motor local, sem rede).",
    "",
    `Recebi: "${text.slice(0, 180)}${text.length > 180 ? "..." : ""}"`,
    "",
    "Para respostas de LLMs reais, conecte uma API gratuita em Admin > Provedores:",
    "  Groq, Google Gemini, OpenRouter (modelos :free) ou Ollama local.",
    "Use /help para os comandos disponiveis.",
  ].join("\n");
}
