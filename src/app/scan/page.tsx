"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";
import DecodeText from "@/components/fx/decode-text";
import type { ScanResult, Severity } from "@/lib/scanner";

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "badge badge-danger",
  high: "badge badge-danger",
  medium: "badge badge-amber",
  low: "badge badge-muted",
  info: "badge badge-neon",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const OWASP: Record<string, string> = {
  exposicao: "A05 · Misconfig",
  configuracao: "A05 · Misconfig",
  cabecalhos: "A05 · Misconfig",
  cookies: "A05 · Misconfig",
  cors: "A05 · Misconfig",
  dns: "A05 · Misconfig",
  tecnologia: "A06 · Components",
  endpoints: "A01 · Access Control",
  conteudo: "A05 · Misconfig",
  informacao: "A05 · Misconfig",
  recon: "Recon",
  criptografia: "A02 · Crypto",
};

const PHASES = [
  "resolvendo alvo + guarda ssrf",
  "recon dns (spf/dmarc/dkim)",
  "certificado e protocolos tls",
  "cabecalhos de seguranca",
  "cookies + cors + metodos",
  "html e tecnologias",
  "caminhos sensiveis",
  "robots + source maps",
  "revisor independente (ia)",
  "relatorio final (ia)",
];

type HistoryRow = {
  id: string;
  url: string;
  score: number;
  findings_count: number;
  criticals: number;
  created_at: string;
};

type ScanResponse = {
  ok?: boolean;
  scan?: ScanResult;
  report?: string;
  aiGenerated?: boolean;
  reviewed?: boolean;
  message?: string;
  error?: string;
};

function scoreColor(score: number) {
  if (score >= 80) return "#00ff9c";
  if (score >= 55) return "#fbbf24";
  return "#ff4444";
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "alvo";
  }
}

export default function ScanPage() {
  const [url, setUrl] = useState("");
  const [authorize, setAuthorize] = useState(false);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState("");
  const [result, setResult] = useState<{ scan: ScanResult; report: string; aiGenerated: boolean; reviewed: boolean } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [filters, setFilters] = useState<Set<Severity>>(new Set(SEVERITY_ORDER));
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/scan", { cache: "no-store" })
      .then((response) => (response.ok ? readJsonSafe<{ history?: HistoryRow[] }>(response) : null))
      .then((data) => setHistory(data?.history ?? []))
      .catch(() => undefined);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseRef.current) clearInterval(phaseRef.current);
    };
  }, []);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLocked("");
    setResult(null);
    if (!url.trim()) {
      setError("Informe a URL do alvo.");
      return;
    }
    if (!authorize) {
      setError("Confirme que voce tem autorizacao para testar este site.");
      return;
    }
    setRunning(true);
    setPhase(0);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    phaseRef.current = setInterval(
      () => setPhase((value) => Math.min(value + 1, PHASES.length - 2)),
      700
    );
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), authorize: true }),
      });
      const payload = await readJsonSafe<ScanResponse>(response);
      if (!response.ok || !payload?.scan) {
        const code = payload?.error ?? "";
        if (
          response.status === 403 &&
          (code === "plan_without_pentest" || code === "module_disabled")
        ) {
          setLocked(payload?.message ?? "Pentest indisponivel para sua conta.");
        } else {
          setError(payload?.message ?? "Falha ao executar a varredura.");
        }
        return;
      }
      setResult({
        scan: payload.scan,
        report: payload.report ?? "",
        aiGenerated: Boolean(payload.aiGenerated),
        reviewed: Boolean(payload.reviewed),
      });
      setPhase(PHASES.length - 1);
      fetch("/api/scan", { cache: "no-store" })
        .then((response) => (response.ok ? readJsonSafe<{ history?: HistoryRow[] }>(response) : null))
        .then((data) => setHistory(data?.history ?? []))
        .catch(() => undefined);
    } catch {
      setError("Falha de rede ao executar a varredura.");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseRef.current) clearInterval(phaseRef.current);
      setRunning(false);
    }
  }

  async function copyReport() {
    if (!result?.report) return;
    try {
      await navigator.clipboard.writeText(result.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Nao foi possivel copiar (permissao do navegador).");
    }
  }

  function downloadReport() {
    if (!result?.report) return;
    const blob = new Blob([result.report], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `pentest-${hostOf(result.scan.url)}-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(href);
  }

  function toggleFilter(severity: Severity) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next.size === 0 ? new Set(SEVERITY_ORDER) : next;
    });
  }

  const scan = result?.scan;
  const counts = scan
    ? SEVERITY_ORDER.reduce<Record<string, number>>((acc, severity) => {
        acc[severity] = scan.findings.filter((f) => f.severity === severity).length;
        return acc;
      }, {})
    : null;
  const visible = scan
    ? scan.findings.filter((finding) => filters.has(finding.severity))
    : [];
  const maxCount = counts ? Math.max(1, ...SEVERITY_ORDER.map((s) => counts[s] ?? 0)) : 1;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <DecodeText
            text="[ pentest de site ]"
            className="text-neon text-xl tracking-[0.2em] uppercase"
          />
          <p className="text-muted text-[12.5px]">
            Recon completo (DNS, TLS, cabecalhos, cookies, CORS, HTML, caminhos
            sensiveis) + revisor independente que derruba falso positivo + relatorio
            final por IA.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-xs"
          onClick={() => window.dispatchEvent(new CustomEvent("nexus:breach"))}
        >
          simular alerta de intrusao
        </button>
      </header>

      <form onSubmit={start} className="panel space-y-4 p-5">
        <div>
          <label className="label" htmlFor="scan-url">
            url do alvo
          </label>
          <input
            id="scan-url"
            className="input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://exemplo.com"
            disabled={running}
            autoComplete="off"
          />
        </div>
        <label className="flex items-start gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={authorize}
            onChange={(event) => setAuthorize(event.target.checked)}
            disabled={running}
            className="mt-0.5"
          />
          confirmo que tenho autorizacao para testar este site (proprio ou com
          permissao escrita do dono)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-neon" disabled={running}>
            {running ? "varredura em andamento..." : "iniciar pentest"}
          </button>
          {running ? (
            <span className="text-neon font-mono text-[12.5px]">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </span>
          ) : null}
        </div>

        {running ? (
          <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-neon transition-all duration-500"
                style={{ width: `${Math.round(((phase + 1) / PHASES.length) * 100)}%` }}
              />
            </div>
            <ul className="grid gap-1 text-[11.5px] sm:grid-cols-2">
              {PHASES.map((item, index) => (
                <li
                  key={item}
                  className={
                    index < phase
                      ? "text-neon/70"
                      : index === phase
                        ? "text-neon animate-pulse"
                        : "text-muted/50"
                  }
                >
                  {index < phase ? "[x] " : index === phase ? "[~] " : "[ ] "}
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}

      {locked ? (
        <section className="panel space-y-3 border-amber-400/40 p-5">
          <p className="text-amber-300 text-[13px]">{locked}</p>
          <div className="flex flex-wrap gap-2">
            <a href="/plano-mudanca/" className="btn btn-xs btn-primary">
              ver planos
            </a>
            <a href="/checkout/" className="btn btn-xs">
              assinar
            </a>
            <a href="/admin/security/" className="btn btn-xs">
              pedir liberacao ao admin
            </a>
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="panel p-4">
          <p className="text-muted text-[11px] tracking-[0.16em] uppercase">
            historico de varreduras
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {history.slice(0, 8).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => setUrl(row.url)}
                  title="recarregar alvo no formulario"
                >
                  <span
                    className="mr-1 inline-block size-1.5 rounded-full"
                    style={{ background: scoreColor(row.score) }}
                  />
                  {hostOf(row.url)} · {row.score}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scan ? (
        <>
          <section className="grid gap-4 p-0 sm:grid-cols-3">
            <div className="panel flex items-center gap-4 p-5 sm:col-span-1">
              <svg viewBox="0 0 120 120" className="size-28 shrink-0 -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#1b2733" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={scoreColor(scan.score)}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={
                    2 * Math.PI * 52 * (1 - Math.max(0, Math.min(100, scan.score)) / 100)
                  }
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div>
                <p className="text-muted text-[11px] tracking-[0.16em] uppercase">nota</p>
                <p
                  className="text-4xl font-bold"
                  style={{ color: scoreColor(scan.score) }}
                >
                  {scan.score}
                </p>
                <p className="text-muted text-[11.5px]">
                  {scan.findings.length} achados · {scan.checksRun.length} checks ·{" "}
                  {(scan.durationMs / 1000).toFixed(1)}s
                </p>
              </div>
            </div>

            <div className="panel space-y-2 p-5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-muted text-[11px] tracking-[0.16em] uppercase">
                  achados por severidade
                </p>
                <p className="text-muted text-[11px]">
                  {result?.reviewed ? "revisor ia: ativo" : "revisor ia: indisponivel"}
                </p>
              </div>
              {SEVERITY_ORDER.map((severity) => (
                <div key={severity} className="flex items-center gap-2">
                  <span className={`${SEVERITY_BADGE[severity]} w-20 justify-center text-center`}>
                    {severity}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${((counts?.[severity] ?? 0) / maxCount) * 100}%`,
                        background:
                          severity === "critical" || severity === "high"
                            ? "#ff4444"
                            : severity === "medium"
                              ? "#fbbf24"
                              : severity === "low"
                                ? "#6b7c8a"
                                : "#00ff9c",
                      }}
                    />
                  </div>
                  <span className="text-muted w-6 text-right text-[12px]">
                    {counts?.[severity] ?? 0}
                  </span>
                </div>
              ))}
              <p className="text-muted pt-1 text-[11.5px]">
                alvo: {scan.finalUrl ?? scan.url} · ip {scan.ip ?? "-"} · status{" "}
                {scan.status ?? "-"} · {scan.startedAt.slice(0, 19).replace("T", " ")}
              </p>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-neon text-sm tracking-[0.18em] uppercase">achados</h2>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_ORDER.map((severity) => (
                  <button
                    key={severity}
                    type="button"
                    onClick={() => toggleFilter(severity)}
                    className={`${SEVERITY_BADGE[severity]} transition ${
                      filters.has(severity) ? "opacity-100" : "opacity-35"
                    }`}
                  >
                    {severity} {counts?.[severity] ?? 0}
                  </button>
                ))}
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {visible.map((finding) => (
                <li
                  key={finding.id}
                  className={`rounded-lg border p-3 transition ${
                    finding.review?.verdict === "rejected"
                      ? "border-line/50 opacity-55"
                      : "border-line hover:border-neon/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={SEVERITY_BADGE[finding.severity]}>
                      {finding.severity}
                    </span>
                    <span className="text-text text-[13px]">{finding.title}</span>
                    <span className="text-muted border border-line rounded px-1.5 py-0.5 text-[10px]">
                      {OWASP[finding.category] ?? finding.category}
                    </span>
                    {finding.review ? (
                      <span
                        className={`badge ${
                          finding.review.verdict === "confirmed"
                            ? "badge-neon"
                            : finding.review.verdict === "rejected"
                              ? "badge-danger"
                              : "badge-amber"
                        }`}
                        title={finding.review.reason}
                      >
                        {finding.review.verdict === "confirmed"
                          ? "revisor: confirmado"
                          : finding.review.verdict === "rejected"
                            ? "revisor: descartado"
                            : "revisor: testar manual"}
                      </span>
                    ) : null}
                    <span className="text-muted ml-auto text-[11px] tracking-[0.14em] uppercase">
                      {finding.category}
                    </span>
                  </div>
                  <p className="text-muted mt-1.5 text-[12.5px] leading-relaxed">
                    {finding.detail}
                  </p>
                  {finding.review ? (
                    <p className="text-muted/80 mt-1 text-[11.5px] italic">
                      revisor: {finding.review.reason}
                    </p>
                  ) : null}
                  {finding.evidence ? (
                    <pre className="bg-ink/70 text-muted mt-2 overflow-x-auto rounded-md p-2 text-[11.5px]">
                      {finding.evidence}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
            {visible.length === 0 ? (
              <p className="text-muted mt-3 text-[12.5px]">
                Nenhum achado nesta severidade.
              </p>
            ) : null}
          </section>

          <section className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
                relatorio {result?.aiGenerated ? "· ia" : "· automatico"}
              </h2>
              <div className="ml-auto flex gap-2">
                <button type="button" className="btn btn-xs" onClick={copyReport}>
                  {copied ? "copiado!" : "copiar"}
                </button>
                <button type="button" className="btn btn-xs" onClick={downloadReport}>
                  baixar .md
                </button>
              </div>
            </div>
            <pre className="text-text mt-3 overflow-x-auto text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {result?.report}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  );
}
