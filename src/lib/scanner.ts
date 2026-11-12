import dns from "node:dns/promises";
import https from "node:https";
import { generateText } from "ai";
import { findModel } from "./model-registry";
import { getLanguageModel } from "./providers";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  detail: string;
  evidence?: string;
};

export type ScanResult = {
  ok: boolean;
  error?: string;
  url: string;
  finalUrl?: string;
  ip?: string;
  server?: string;
  status?: number;
  durationMs: number;
  score: number;
  findings: Finding[];
  checksRun: string[];
  startedAt: string;
};

const TIMEOUT_MS = 6_000;
const MAX_BODY = 400_000;
const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

const SENSITIVE_PATHS: {
  path: string;
  severity: Severity;
  title: string;
  category: string;
  bodyMustMatch?: RegExp;
  okIfMissing?: boolean;
}[] = [
  { path: "/.git/config", severity: "critical", title: "Repositorio Git exposto", category: "exposicao", bodyMustMatch: /\[core\]/i },
  { path: "/.git/HEAD", severity: "high", title: "HEAD do Git exposto", category: "exposicao", bodyMustMatch: /ref:/i },
  { path: "/.env", severity: "critical", title: "Arquivo .env exposto", category: "exposicao", bodyMustMatch: /(API_KEY|SECRET|PASSWORD|DATABASE_URL|TOKEN)/i },
  { path: "/.env.backup", severity: "high", title: "Backup de .env exposto", category: "exposicao" },
  { path: "/.aws/credentials", severity: "critical", title: "Credenciais AWS expostas", category: "exposicao", bodyMustMatch: /\[default\]/i },
  { path: "/wp-config.php.bak", severity: "high", title: "Backup do wp-config exposto", category: "exposicao", bodyMustMatch: /DB_PASSWORD|table_prefix/i },
  { path: "/config.php.bak", severity: "high", title: "Backup de config PHP exposto", category: "exposicao" },
  { path: "/backup.sql", severity: "high", title: "Dump de banco SQL exposto", category: "exposicao", bodyMustMatch: /CREATE TABLE|INSERT INTO/i },
  { path: "/dump.sql", severity: "high", title: "Dump de banco SQL exposto", category: "exposicao", bodyMustMatch: /CREATE TABLE|INSERT INTO/i },
  { path: "/.DS_Store", severity: "medium", title: "Arquivo .DS_Store exposto", category: "exposicao" },
  { path: "/.svn/entries", severity: "medium", title: "Metadados do SVN expostos", category: "exposicao" },
  { path: "/phpinfo.php", severity: "medium", title: "phpinfo() acessivel", category: "configuracao" },
  { path: "/server-status", severity: "medium", title: "Modulo server-status do Apache acessivel", category: "configuracao" },
  { path: "/actuator/health", severity: "medium", title: "Spring Actuator exposto", category: "configuracao" },
  { path: "/actuator/env", severity: "high", title: "Spring Actuator /env exposto", category: "configuracao" },
  { path: "/phpmyadmin/", severity: "medium", title: "phpMyAdmin acessivel", category: "configuracao" },
  { path: "/admin/", severity: "info", title: "Painel administrativo acessivel", category: "configuracao" },
  { path: "/wp-admin/", severity: "info", title: "Painel do WordPress acessivel", category: "configuracao" },
];

function scoreFromFindings(findings: Finding[]): number {
  let score = 100;
  for (const finding of findings) score -= SEVERITY_WEIGHT[finding.severity];
  return Math.max(0, Math.min(100, score));
}

function isPrivateAddress(address: string): boolean {
  const addr = address.replace(/^::ffff:/, "");
  if (addr.includes(":")) {
    // IPv6
    const lower = addr.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }
  const parts = addr.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

async function timedFetch(
  input: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_MS
): Promise<Response> {
  return fetch(input, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function safeText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, MAX_BODY);
  } catch {
    return "";
  }
}

function checkTls(hostname: string): Promise<{
  protocol?: string;
  validTo?: string;
  issuer?: string;
  daysLeft?: number;
  error?: string;
}> {
  type TlsSocketLike = {
    destroy(): void;
    getPeerCertificate?: () => { valid_to?: string; issuer?: { CN?: string } } | null;
    getProtocol?: () => string | null;
  };

  return new Promise((resolve) => {
    const request = https.request(
      {
        hostname,
        port: 443,
        method: "HEAD",
        path: "/",
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const socket = res.socket as unknown as TlsSocketLike | null;
        const cert = socket?.getPeerCertificate?.();
        socket?.destroy();
        if (!cert || !cert.valid_to) {
          resolve({ error: "certificado indisponivel" });
          return;
        }
        const daysLeft = Math.floor(
          (new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000
        );
        resolve({
          protocol: socket?.getProtocol?.() ?? undefined,
          validTo: cert.valid_to,
          issuer: cert.issuer?.CN,
          daysLeft,
        });
      }
    );
    request.on("error", (error) => resolve({ error: error.message }));
    request.on("timeout", () => {
      request.destroy();
      resolve({ error: "timeout TLS" });
    });
    request.end();
  });
}

export async function runScan(rawUrl: string): Promise<ScanResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const findings: Finding[] = [];
  const checksRun: string[] = [];

  const base: ScanResult = {
    ok: false,
    url: rawUrl,
    durationMs: 0,
    score: 0,
    findings,
    checksRun,
    startedAt,
  };

  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    return { ...base, error: "URL invalida. Use o formato https://exemplo.com" };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ...base, error: "Apenas http:// e https:// sao aceitos." };
  }

  // Guarda SSRF: nada de localhost/rede interna.
  const hostname = target.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return { ...base, error: "Alvo bloqueado: endereco local/interno nao e permitido." };
  }
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return { ...base, error: `Nao foi possivel resolver o host ${hostname}.` };
  }
  if (addresses.length === 0) {
    return { ...base, error: `Host ${hostname} nao resolveu nenhum endereco.` };
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    return { ...base, error: "Alvo bloqueado: endereco de rede privada/reservada." };
  }
  const ip = addresses[0].address;
  checksRun.push("resolucao_dns", "guarda_ssrf");

  findings.push({
    id: "target-ip",
    title: `Alvo resolvido em ${ip}`,
    severity: "info",
    category: "recon",
    detail: `Host ${hostname} resolveu para ${addresses.length} endereco(s). Nenhum e de rede interna.`,
  });

  // TLS
  if (target.protocol === "https:") {
    checksRun.push("tls_certificado");
    const tls = await checkTls(hostname);
    if (tls.error) {
      findings.push({
        id: "tls-error",
        title: "Nao foi possivel validar o certificado TLS",
        severity: "low",
        category: "criptografia",
        detail: `Falha na leitura do certificado: ${tls.error}.`,
      });
    } else {
      if (typeof tls.daysLeft === "number" && tls.daysLeft < 0) {
        findings.push({
          id: "tls-expired",
          title: "Certificado TLS expirado",
          severity: "high",
          category: "criptografia",
          detail: `Valido ate ${tls.validTo}.`,
        });
      } else if (typeof tls.daysLeft === "number" && tls.daysLeft < 14) {
        findings.push({
          id: "tls-expiring",
          title: "Certificado TLS expira em breve",
          severity: "medium",
          category: "criptografia",
          detail: `Expira em ${tls.daysLeft} dia(s) (${tls.validTo}).`,
        });
      } else {
        findings.push({
          id: "tls-ok",
          title: "Certificado TLS valido",
          severity: "info",
          category: "criptografia",
          detail: `Protocolo ${tls.protocol ?? "?"} · emissor ${tls.issuer ?? "?"} · expira ${tls.validTo} (${tls.daysLeft} dias).`,
        });
      }
    }
  }

  // Pagina principal
  checksRun.push("pagina_principal");
  let mainResponse: Response | null = null;
  let html = "";
  try {
    mainResponse = await timedFetch(target.toString(), {
      headers: { "user-agent": "HACKER-AI-Scanner/1.0 (pentest autorizado)" },
    });
    html = await safeText(mainResponse);
  } catch {
    findings.push({
      id: "main-unreachable",
      title: "Pagina principal inacessivel",
      severity: "info",
      category: "recon",
      detail: "Nao foi possivel conectar ao alvo dentro do tempo limite.",
    });
  }

  if (mainResponse) {
    base.status = mainResponse.status;
    base.finalUrl = mainResponse.headers.get("location") || target.toString();
    const server = mainResponse.headers.get("server");
    base.server = server ?? undefined;

    const headers = mainResponse.headers;
    const headerChecks: [string, Severity, string, string][] = [
      ["strict-transport-security", "medium", "HSTS ausente", "Sem Strict-Transport-Security o navegador aceita conexoes HTTP downgrade."],
      ["content-security-policy", "medium", "Content-Security-Policy ausente", "Sem CSP nao ha mitigacao contra XSS/injecao de script."],
      ["x-frame-options", "medium", "X-Frame-Options ausente", "Sem X-Frame-Options/CSP frame-ancestors o site pode ser iframado (clickjacking)."],
      ["x-content-type-options", "low", "X-Content-Type-Options ausente", "Sem nosniff o navegador pode interpretar tipos errados (MIME sniffing)."],
      ["referrer-policy", "low", "Referrer-Policy ausente", "URLs podem vazar para terceiros via cabecalho Referer."],
      ["permissions-policy", "low", "Permissions-Policy ausente", "Sem controle de APIs do navegador (camera, mic, geolocalizacao)."],
    ];
    for (const [header, severity, title, detail] of headerChecks) {
      checksRun.push(`header_${header}`);
      if (!headers.get(header)) {
        findings.push({ id: `missing-${header}`, title, severity, category: "cabecalhos", detail });
      }
    }
    const csp = headers.get("content-security-policy") ?? "";
    if (csp && !/frame-ancestors/i.test(csp)) {
      findings.push({
        id: "csp-no-frame-ancestors",
        title: "CSP sem frame-ancestors",
        severity: "low",
        category: "cabecalhos",
        detail: "O CSP existe mas nao define frame-ancestors; combine com X-Frame-Options.",
      });
    }

    if (server) {
      findings.push({
        id: "server-banner",
        title: "Banner de servidor exposto",
        severity: "low",
        category: "informacao",
        detail: `Cabecalho Server revela software: ${server}.`,
      });
    }
    const poweredBy = headers.get("x-powered-by");
    if (poweredBy) {
      findings.push({
        id: "x-powered-by",
        title: "X-Powered-By exposto",
        severity: "low",
        category: "informacao",
        detail: `Tecnologia revelada: ${poweredBy}.`,
      });
    }

    // Cookies
    checksRun.push("flags_cookie");
    const rawCookies =
      (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
      (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
    for (const cookie of rawCookies) {
      const name = cookie.split("=")[0]?.trim() ?? "cookie";
      const flags: string[] = [];
      if (!/;\s*secure/i.test(cookie)) flags.push("Secure");
      if (!/;\s*httponly/i.test(cookie)) flags.push("HttpOnly");
      if (!/;\s*samesite/i.test(cookie)) flags.push("SameSite");
      if (flags.length > 0) {
        findings.push({
          id: `cookie-${name}`,
          title: `Cookie "${name}" sem ${flags.join(", ")}`,
          severity: "medium",
          category: "cookies",
          detail: "Cookies sem Secure/HttpOnly/SameSite facilitam roubo de sessao.",
          evidence: cookie.slice(0, 160),
        });
      }
    }

    // Redirecionamento HTTP -> HTTPS
    checksRun.push("redirect_https");
    if (target.protocol === "http:") {
      try {
        const httpProbe = await timedFetch(
          `http://${target.host}${target.pathname || "/"}`,
          { redirect: "manual" },
          5_000
        );
        const location = httpProbe.headers.get("location") ?? "";
        const goesHttps = httpProbe.status >= 300 && httpProbe.status < 400 && location.startsWith("https:");
        if (!goesHttps) {
          findings.push({
            id: "no-https-redirect",
            title: "HTTP nao redireciona para HTTPS",
            severity: "medium",
            category: "criptografia",
            detail: `Status ${httpProbe.status} em http:// (Location: ${location || "nenhum"}).`,
          });
        } else {
          findings.push({
            id: "https-redirect-ok",
            title: "Redirecionamento HTTP para HTTPS ativo",
            severity: "info",
            category: "criptografia",
            detail: `http:// -> ${location} (status ${httpProbe.status}).`,
          });
        }
      } catch {
        // falha no probe: ignorar
      }
    }

    // CORS com origem maliciosa
    checksRun.push("cors_origin_reflexo");
    try {
      const corsProbe = await timedFetch(target.toString(), {
        headers: { origin: "https://evil-scan.test" },
      }, 5_000);
      const acao = corsProbe.headers.get("access-control-allow-origin");
      const credentials = corsResponseHasCredentials(corsProbe);
      if (acao === "*" || acao === "https://evil-scan.test") {
        findings.push({
          id: "cors-misconfig",
          title: "CORS reflete origem arbitraria",
          severity: acao === "*" && credentials ? "high" : "medium",
          category: "cors",
          detail: `Access-Control-Allow-Origin: ${acao}${credentials ? " (com credenciais)" : ""}. Qualquer site pode ler respostas.`,
        });
      }
    } catch {
      // ignorar
    }

    // Metodos HTTP
    checksRun.push("metodos_http");
    try {
      const options = await timedFetch(target.toString(), { method: "OPTIONS" }, 5_000);
      const allow = (options.headers.get("allow") ?? "").toUpperCase();
      if (allow.includes("TRACE")) {
        findings.push({
          id: "trace-enabled",
          title: "Metodo TRACE habilitado",
          severity: "medium",
          category: "configuracao",
          detail: "TRACE permite ecoar a request e pode auxiliar em ataques XST.",
        });
      }
      const trace = await timedFetch(target.toString(), { method: "TRACE" }, 5_000);
      if (trace.status >= 200 && trace.status < 300) {
        findings.push({
          id: "trace-responds",
          title: "Servidor responde ao metodo TRACE",
          severity: "medium",
          category: "configuracao",
          detail: `TRACE retornou status ${trace.status}.`,
        });
      }
    } catch {
      // ignorar
    }

    // Analise do HTML
    checksRun.push("analise_html");
    if (html) {
      const mixed = html.match(/(?:src|href)\s*=\s*["']http:\/\/[^"']+/gi) ?? [];
      if (mixed.length > 0) {
        findings.push({
          id: "mixed-content",
          title: "Conteudo misto (HTTP em pagina HTTPS)",
          severity: "medium",
          category: "conteudo",
          detail: `${mixed.length} recurso(s) carregado(s) via HTTP.`,
          evidence: mixed.slice(0, 3).join("\n").slice(0, 300),
        });
      }

      const generator = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
      if (generator) {
        findings.push({
          id: "generator-meta",
          title: "Meta generator revela tecnologia",
          severity: "info",
          category: "informacao",
          detail: `Gerador: ${generator[1]}.`,
        });
      }

      const emails = [
        ...new Set(
          (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).filter(
            (m) => !m.toLowerCase().endsWith(".png") && !m.toLowerCase().endsWith(".jpg")
          )
        ),
      ];
      if (emails.length > 0) {
        findings.push({
          id: "emails-expostos",
          title: "E-mails expostos no HTML",
          severity: "low",
          category: "informacao",
          detail: `${emails.length} e-mail(s) encontrados na pagina (alvo para phishing/spam).`,
          evidence: emails.slice(0, 5).join(", "),
        });
      }

      const ips = (html.match(/\b(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g) ?? []);
      if (ips.length > 0) {
        findings.push({
          id: "ips-internas",
          title: "Enderecos IP internos no HTML",
          severity: "medium",
          category: "informacao",
          detail: `${ips.length} ocorrencia(s) de IP privado no conteudo entregue.`,
          evidence: [...new Set(ips)].slice(0, 5).join(", "),
        });
      }

      const leaks = (html.match(/<!--[\s\S]{0,400}?-->/g) ?? []).filter((c) =>
        /(senha|password|token|api[_-]?key|secret|todo|fixme|xxx)/i.test(c)
      );
      if (leaks.length > 0) {
        findings.push({
          id: "comentarios-sensiveis",
          title: "Comentarios HTML com dados sensiveis",
          severity: "high",
          category: "conteudo",
          detail: `${leaks.length} comentario(s) com palavras-chave sensiveis.`,
          evidence: leaks[0].replace(/\s+/g, " ").slice(0, 240),
        });
      }

      if (/index of \//i.test(html)) {
        findings.push({
          id: "directory-listing",
          title: "Listagem de diretorio ativa",
          severity: "high",
          category: "configuracao",
          detail: "O servidor exibe 'Index of /', permitindo navegacao de arquivos.",
        });
      }

      const forms = html.match(/<form[^>]+action=["']http:\/\/[^"']+/gi) ?? [];
      if (forms.length > 0) {
        findings.push({
          id: "form-http",
          title: "Formulario enviando dados via HTTP",
          severity: "medium",
          category: "conteudo",
          detail: `${forms.length} formulario(s) com action em HTTP (credenciais em texto claro).`,
        });
      }
    }
  }

  // Caminhos sensiveis
  checksRun.push("caminhos_sensiveis");
  const origin = target.origin;
  const pathResults = await Promise.allSettled(
    SENSITIVE_PATHS.map(async (entry) => {
      const url = `${origin}${entry.path}`;
      let response: Response;
      try {
        response = await timedFetch(url, { headers: { "user-agent": "HACKER-AI-Scanner/1.0" } }, 5_000);
      } catch {
        return null;
      }
      const found = response.status >= 200 && response.status < 300;
      if (entry.okIfMissing) {
        return { entry, present: found, status: response.status, body: "" };
      }
      if (!found) return null;
      let body = "";
      if (entry.bodyMustMatch) {
        body = await safeText(response);
        if (!entry.bodyMustMatch.test(body)) return null;
      }
      return { entry, present: true, status: response.status, body };
    })
  );

  for (const result of pathResults) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const { entry, present, status, body } = result.value;
    if (entry.okIfMissing && !present) {
      findings.push({
        id: `missing-${entry.path}`,
        title: "security.txt ausente",
        severity: "low",
        category: "configuracao",
        detail: "Sem /.well-known/security.txt nao ha canal oficial para reporte de falhas.",
      });
      continue;
    }
    if (!present) continue;
    findings.push({
      id: `path-${entry.path}`,
      title: entry.title,
      severity: entry.severity,
      category: entry.category,
      detail: `${entry.path} retornou status ${status} para o scanner.`,
      evidence: body ? body.slice(0, 200) : undefined,
    });
  }

  // robots.txt
  checksRun.push("robots_txt");
  try {
    const robots = await timedFetch(`${origin}/robots.txt`, {}, 5_000);
    if (robots.status >= 200 && robots.status < 300) {
      const text = (await safeText(robots)).slice(0, 4000);
      const disallowed = (text.match(/^Disallow:\s*(.+)$/gim) ?? []).map((line) =>
        line.replace(/^Disallow:\s*/i, "").trim()
      );
      const sensitive = disallowed.filter((path) =>
        /(admin|backup|config|private|wp-|phpmyadmin|\.git|\.env)/i.test(path)
      );
      findings.push({
        id: "robots-info",
        title: "robots.txt revela estrutura do site",
        severity: sensitive.length > 0 ? "low" : "info",
        category: "recon",
        detail: `${disallowed.length} regra(s) Disallow${sensitive.length ? `, ${sensitive.length} apontam para areas sensiveis` : ""}.`,
        evidence: (sensitive.length ? sensitive : disallowed).slice(0, 6).join("\n").slice(0, 300) || undefined,
      });
    }
  } catch {
    // sem robots.txt: ok
  }

  const durationMs = Date.now() - start;
  return {
    ...base,
    ok: true,
    findings,
    checksRun: [...new Set(checksRun)],
    durationMs,
    score: scoreFromFindings(findings),
  };
}

function corsResponseHasCredentials(response: Response): boolean {
  return Boolean(response.headers.get("access-control-allow-credentials"));
}

const PENTEST_SYSTEM = `Voce e um analista de seguranca ofensiva (pentest) senior.
Recebera o JSON de uma varredura automatica de um site ALVO AUTORIZADO pelo administrador.
Escreva em portugues do Brasil, direto e tecnico, sem emojis, em Markdown.
Estrutura obrigatoria:
1. Resumo executivo (nota de risco em 1 linha + os 3 pontos mais importantes)
2. Vulnerabilidades por criticidade (so as presentes no JSON, com impacto real)
3. Plano de remediacao priorizado (ordem de correcao, passo a passo)
4. Proximos passos de teste manual (o que um pentester humano deveria validar)
Regras: nao invente vulnerabilidades que nao estejam nos dados; diga claramente
quando um check nao pôde ser executado; no maximo 700 palavras.`;

export async function generatePentestReport(scan: ScanResult): Promise<string | null> {
  const modelIds = [
    "groq/gpt-oss-20b",
    "groq/llama-3.3-70b-versatile",
    "groq/gpt-oss-120b",
  ];

  const payload = JSON.stringify(
    {
      url: scan.url,
      ip: scan.ip,
      status: scan.status,
      server: scan.server,
      score: scan.score,
      checksExecuted: scan.checksRun,
      findings: scan.findings.map((f) => ({
        severidade: f.severity,
        categoria: f.category,
        titulo: f.title,
        detalhe: f.detail,
        evidencia: f.evidence,
      })),
    },
    null,
    1
  );

  for (const id of modelIds) {
    const def = findModel(id);
    if (!def) continue;
    try {
      const model = await getLanguageModel(def);
      const result = await generateText({
        model,
        system: PENTEST_SYSTEM,
        prompt: `Dados da varredura autorizada:\n${payload}`,
        maxOutputTokens: 1400,
        abortSignal: AbortSignal.timeout(60_000),
      });
      if (result.text?.trim()) return result.text.trim();
    } catch {
      // tentar proximo modelo
    }
  }
  return null;
}

export function buildFallbackReport(scan: ScanResult): string {
  const bySeverity = (severity: Severity) =>
    scan.findings.filter((f) => f.severity === severity);

  const lines: string[] = [];
  lines.push(`# Relatorio de pentest · ${scan.url}`);
  lines.push("");
  lines.push(
    `**Nota de risco:** ${scan.score}/100 · ${scan.findings.length} achado(s) em ${scan.checksRun.length} checks (${(scan.durationMs / 1000).toFixed(1)}s).`
  );
  lines.push("");
  lines.push("## Resumo por criticidade");
  for (const severity of ["critical", "high", "medium", "low", "info"] as Severity[]) {
    const list = bySeverity(severity);
    lines.push(`- **${severity}**: ${list.length}`);
    for (const finding of list.slice(0, 8)) {
      lines.push(`  - ${finding.title} — ${finding.detail}`);
    }
    if (list.length > 8) lines.push(`  - ... e mais ${list.length - 8}.`);
  }
  lines.push("");
  lines.push("## Proximos passos");
  lines.push(
    "- A IA nao retornou relatorio (chave de provedor ausente ou falha). Revise os achados acima manualmente e valide cada item com teste controlado."
  );
  return lines.join("\n");
}
