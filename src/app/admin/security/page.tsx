"use client";

import { useCallback, useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type PlanRow = {
  id: string;
  name: string;
  price: number;
  capabilities: string[];
};

type ScanRow = {
  id: string;
  user_email: string;
  url: string;
  score: number;
  findings_count: number;
  criticals: number;
  highs: number;
  status: string;
  created_at: string;
};

type SecurityPayload = {
  ok?: boolean;
  enabled?: boolean;
  plans?: PlanRow[];
  scans?: ScanRow[];
  message?: string;
};

function fmtDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function scoreClass(score: number) {
  if (score >= 80) return "text-neon";
  if (score >= 55) return "text-amber-300";
  return "text-danger";
}

export default function AdminSecurityPage() {
  const [enabled, setEnabled] = useState(true);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/security", { cache: "no-store" });
      const data = await readJsonSafe<SecurityPayload>(response);
      if (!response.ok || !data) {
        setError(data?.message ?? "Falha ao carregar a seguranca.");
        return;
      }
      setEnabled(data.enabled !== false);
      setPlans(data.plans ?? []);
      setScans(data.scans ?? []);
    } catch {
      setError("Falha de rede ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(payload: { enabled?: boolean; planAccess?: Record<string, boolean> }) {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJsonSafe<SecurityPayload>(response);
      if (!response.ok || !data) {
        setError(data?.message ?? "Falha ao salvar.");
        return;
      }
      setEnabled(data.enabled !== false);
      setPlans(data.plans ?? []);
      setMessage("configuracao de pentest salva.");
    } catch {
      setError("Falha de rede ao salvar.");
    }
  }

  async function toggleGlobal(next: boolean) {
    setEnabled(next);
    await save({ enabled: next });
  }

  async function togglePlan(planId: string, allow: boolean) {
    await save({ planAccess: { [planId]: allow } });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ seguranca · pentest ]
          </h1>
          <p className="text-muted text-[12.5px]">
            Libere ou bloqueie o modulo de pentest por plano e acompanhe as
            varreduras feitas pelos usuarios.
          </p>
        </div>
        <a href="/scan/" target="_blank" className="btn btn-xs">
          abrir /scan
        </a>
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}
      {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}

      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-neon text-sm">modulo global</p>
          <p className="text-muted text-[12.5px]">
            {enabled
              ? "PENTEST LIBERADO — usuarios com a capacidade no plano podem rodar varreduras."
              : "PENTEST BLOQUEADO — todos recebem 403, mesmo com o plano certo."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${enabled ? "badge-neon" : "badge-danger"}`}>
            {enabled ? "ativo" : "desativado"}
          </span>
          <button
            type="button"
            className={`btn btn-xs ${enabled ? "btn-danger" : "btn-primary"}`}
            onClick={() => toggleGlobal(!enabled)}
            disabled={loading}
          >
            {enabled ? "desativar modulo" : "ativar modulo"}
          </button>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          liberacao por plano
        </h2>
        <ul className="mt-3 space-y-2">
          {plans.map((plan) => {
            const allowed = plan.capabilities.includes("pentest");
            return (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"
              >
                <div>
                  <p className="text-text text-[13px]">{plan.name}</p>
                  <p className="text-muted text-[11.5px]">
                    {plan.id} · R$ {plan.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${allowed ? "badge-neon" : "badge-muted"}`}>
                    {allowed ? "pentest liberado" : "sem pentest"}
                  </span>
                  <button
                    type="button"
                    className={`btn btn-xs ${allowed ? "btn-danger" : "btn-primary"}`}
                    onClick={() => togglePlan(plan.id, !allowed)}
                    disabled={loading}
                  >
                    {allowed ? "revogar" : "liberar"}
                  </button>
                </div>
              </li>
            );
          })}
          {plans.length === 0 ? (
            <li className="text-muted text-[12.5px]">Nenhum plano encontrado.</li>
          ) : null}
        </ul>
      </section>

      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            varreduras recentes
          </h2>
          <button type="button" className="btn btn-xs" onClick={load} disabled={loading}>
            {loading ? "atualizando..." : "atualizar"}
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-muted border-b border-line text-[11px] tracking-[0.14em] uppercase">
                <th className="py-2 pr-3">data</th>
                <th className="py-2 pr-3">usuario</th>
                <th className="py-2 pr-3">alvo</th>
                <th className="py-2 pr-3">nota</th>
                <th className="py-2 pr-3">achados</th>
                <th className="py-2 pr-3">crit / alt</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-b border-line/60">
                  <td className="py-2 pr-3 font-mono">{fmtDate(scan.created_at)}</td>
                  <td className="py-2 pr-3">{scan.user_email}</td>
                  <td className="py-2 pr-3">
                    <span className="block max-w-[280px] truncate" title={scan.url}>
                      {scan.url}
                    </span>
                  </td>
                  <td className={`py-2 pr-3 font-bold ${scoreClass(scan.score)}`}>
                    {scan.score}
                  </td>
                  <td className="py-2 pr-3">{scan.findings_count}</td>
                  <td className="py-2 pr-3">
                    {scan.criticals} / {scan.highs}
                  </td>
                </tr>
              ))}
              {scans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted py-3">
                    Nenhuma varredura registrada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
