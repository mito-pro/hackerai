"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ModelTestResult = {
  id: string;
  label: string;
  provider: string;
  status: "ok" | "error";
  message: string;
  latencyMs?: number;
};

type ProviderPing = {
  provider: string;
  ok: boolean;
  message: string;
  latencyMs: number;
};

export default function AdminModelsTestPage() {
  const [results, setResults] = useState<ModelTestResult[]>([]);
  const [providers, setProviders] = useState<ProviderPing[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    total: number;
    ok: number;
    error: number;
  } | null>(null);
  const [error, setError] = useState("");

  async function runTests() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/models/test", {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Falha ao testar modelos.");
        return;
      }
      setSummary({ total: data.total, ok: data.ok, error: data.error });
      setResults(data.results);
      setProviders(data.providers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao testar modelos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runTests();
  }, []);

  const okResults = results.filter((r) => r.status === "ok");
  const errorResults = results.filter((r) => r.status === "error");

  const hasErrors = summary ? summary.error > 0 : false;

  return (
    <div className="space-y-5">
      <header className="panel p-5">
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
          [ teste de modelos ]
        </h1>
        <p className="text-muted mt-1 text-[12.5px]">
          Cada provedor configurado recebe um ping real de chat. Execute
          novamente apos alterar chaves em Admin {">"} Provedores.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loading}
            className={`btn btn-primary ${loading ? "opacity-50" : ""}`}
            onClick={runTests}
          >
            {loading ? "testando..." : "reexecutar testes"}
          </button>
          {summary ? (
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="badge badge-neon">{summary.ok} funcionando</span>
              {hasErrors ? (
                <span className="badge badge-danger">
                  {summary.error} com erro
                </span>
              ) : null}
              <span className="text-muted">de {summary.total}</span>
            </div>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="panel border-danger/40 p-3 text-danger text-[12.5px]">
          {error}
        </p>
      ) : null}

      {providers.length ? (
        <section className="panel p-5">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            [ provedores ]
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((ping) => (
              <div
                key={ping.provider}
                className="panel-flat flex items-start justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-neon text-[12.5px]">{ping.provider}</p>
                  <p
                    className="text-muted truncate text-[11.5px]"
                    title={ping.message}
                  >
                    {ping.message}
                  </p>
                </div>
                <span
                  className={`badge ${ping.ok ? "badge-neon" : "badge-danger"}`}
                >
                  {ping.ok ? "ok" : "erro"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          [ resultados ]
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr>
                <th className="pb-2 text-[12px] text-muted uppercase">modelo</th>
                <th className="pb-2 text-[12px] text-muted uppercase">provedor</th>
                <th className="pb-2 text-[12px] text-muted uppercase">status</th>
                <th className="pb-2 text-[12px] text-muted uppercase">latencia</th>
                <th className="pb-2 text-[12px] text-muted uppercase">detalhe</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-muted text-center">
                    sem resultados. clique em reexecutar testes.
                  </td>
                </tr>
              ) : null}
              {okResults.map((model) => (
                <tr key={model.id} className="border-t border-line">
                  <td className="py-3 text-[12.5px] text-neon">{model.label}</td>
                  <td className="py-3 text-[12.5px] text-muted">{model.provider}</td>
                  <td className="py-3 text-[12.5px]">
                    <span className="badge badge-neon">ok</span>
                  </td>
                  <td className="py-3 text-[12.5px] text-muted">
                    {model.latencyMs != null ? `${model.latencyMs}ms` : "-"}
                  </td>
                  <td className="py-3 text-[12.5px] text-muted">{model.message}</td>
                </tr>
              ))}
              {errorResults.map((model) => (
                <tr key={model.id} className="border-t border-line bg-red/10">
                  <td className="py-3 text-[12.5px]">{model.label}</td>
                  <td className="py-3 text-[12.5px] text-muted">{model.provider}</td>
                  <td className="py-3 text-[12.5px]">
                    <span className="badge badge-danger">erro</span>
                  </td>
                  <td className="py-3 text-[12.5px] text-muted">
                    {model.latencyMs != null ? `${model.latencyMs}ms` : "-"}
                  </td>
                  <td className="py-3 text-[12.5px] text-muted">{model.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.length > 0 ? (
          <p className="mt-3 text-muted text-[12px]">
            Modelos com erro geralmente indicam chave ausente, cota esgotada ou
            provedor fora do ar. Corrija em Admin {">"} Provedores.
          </p>
        ) : null}
      </section>

      <div className="mt-4">
        <Link href="/admin/providers/" className="btn btn-xs btn-outline">
          voltar para provedores
        </Link>
      </div>
    </div>
  );
}
