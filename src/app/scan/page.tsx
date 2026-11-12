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

type ScanResponse = {
  ok?: boolean;
  scan?: ScanResult;
  report?: string;
  aiGenerated?: boolean;
  message?: string;
};

function scoreColor(score: number) {
  if (score >= 80) return "text-neon";
  if (score >= 55) return "text-amber-300";
  return "text-danger";
}

export default function ScanPage() {
  const [url, setUrl] = useState("");
  const [authorize, setAuthorize] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ scan: ScanResult; report: string; aiGenerated: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError("");
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
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), authorize: true }),
      });
      const payload = await readJsonSafe<ScanResponse>(response);
      if (!response.ok || !payload?.scan) {
        setError(payload?.message ?? "Falha ao executar a varredura.");
        return;
      }
      setResult({
        scan: payload.scan,
        report: payload.report ?? "",
        aiGenerated: Boolean(payload.aiGenerated),
      });
    } catch {
      setError("Falha de rede ao executar a varredura.");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setRunning(false);
    }
  }

  const scan = result?.scan;
  const counts = scan
    ? SEVERITY_ORDER.reduce<Record<string, number>>((acc, severity) => {
        acc[severity] = scan.findings.filter((f) => f.severity === severity).length;
        return acc;
      }, {})
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <header className="space-y-1">
        <DecodeText text="[ pentest de site ]" className="text-neon text-xl tracking-[0.2em] uppercase" />
        <p className="text-muted text-[12.5px]">
          Varredura completa: cabecalhos, TLS, cookies, CORS, metodos HTTP, caminhos
          sensiveis (.git, .env, dumps), conteudo do HTML e robots.txt — com relatorio
          gerado por IA.
        </p>
      </header>

      <form onSubmit={start} className="panel space-y-4 p-5">
        <div>
          <label className="label" htmlFor="scan-url">url do alvo</label>
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
              {String(elapsed % 60).padStart(2, "0")} · executando checks...
            </span>
          ) : null}
        </div>
      </form>

      {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}

      {scan ? (
        <>
          <section className="panel grid gap-4 p-5 sm:grid-cols-4">
            <div>
              <p className="text-muted text-[11px] tracking-[0.16em] uppercase">nota de risco</p>
              <p className={`text-3xl font-bold ${scoreColor(scan.score)}`}>{scan.score}</p>
              <p className="text-muted text-[11.5px]">/100</p>
            </div>
            <div>
              <p className="text-muted text-[11px] tracking-[0.16em] uppercase">achados</p>
              <p className="text-text text-3xl font-bold">{scan.findings.length}</p>
              <p className="text-muted text-[11.5px]">{scan.checksRun.length} checks</p>
            </div>
            <div>
              <p className="text-muted text-[11px] tracking-[0.16em] uppercase">alvo</p>
              <p className="text-text truncate text-[12.5px]" title={scan.finalUrl ?? scan.url}>
                {scan.finalUrl ?? scan.url}
              </p>
              <p className="text-muted font-mono text-[11.5px]">
                {scan.ip ?? "-"} · {scan.status ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-muted text-[11px] tracking-[0.16em] uppercase">duracao</p>
              <p className="text-text text-[15px]">{(scan.durationMs / 1000).toFixed(1)}s</p>
              <p className="text-muted text-[11.5px]">{scan.startedAt.slice(0, 19).replace("T", " ")}</p>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-neon text-sm tracking-[0.18em] uppercase">achados</h2>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_ORDER.map((severity) => (
                  <span key={severity} className={SEVERITY_BADGE[severity]}>
                    {severity} {counts?.[severity] ?? 0}
                  </span>
                ))}
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {SEVERITY_ORDER.flatMap((severity) =>
                scan.findings
                  .filter((finding) => finding.severity === severity)
                  .map((finding) => (
                    <li key={finding.id} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={SEVERITY_BADGE[finding.severity]}>
                          {finding.severity}
                        </span>
                        <span className="text-text text-[13px]">{finding.title}</span>
                        <span className="text-muted ml-auto text-[11px] tracking-[0.14em] uppercase">
                          {finding.category}
                        </span>
                      </div>
                      <p className="text-muted mt-1.5 text-[12.5px] leading-relaxed">
                        {finding.detail}
                      </p>
                      {finding.evidence ? (
                        <pre className="bg-ink/70 text-muted mt-2 overflow-x-auto rounded-md p-2 text-[11.5px]">
                          {finding.evidence}
                        </pre>
                      ) : null}
                    </li>
                  ))
              )}
            </ul>
            {scan.findings.length === 0 ? (
              <p className="text-muted mt-3 text-[12.5px]">
                Nenhum achado relevante nos checks executados.
              </p>
            ) : null}
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
                relatorio {result?.aiGenerated ? "· gerado por IA" : "· automatico"}
              </h2>
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
