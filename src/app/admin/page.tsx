"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTime, formatNumber, readJsonSafe } from "@/lib/utils";
import { PROVIDER_LABELS } from "@/lib/model-registry";

type Stats = {
  totals: {
    users: number;
    active: number;
    banned: number;
    messages: number;
    tokens: number;
    chats: number;
    sessions: number;
  };
  daily: { day: string; requests: number; tokens: number }[];
  byProvider: { provider: string; requests: number; tokens: number }[];
  topUsers: {
    id: string;
    email: string;
    name: string;
    plan_id: string;
    tokens_used: number;
    requests: number;
  }[];
  recentUsers: {
    id: string;
    email: string;
    role: string;
    plan_id: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
    tokens_used: number;
  }[];
};

type PlanSummary = {
  id: string;
  name: string;
  models: number;
  missing: string[];
};

type PlansPayload = {
  plans?: { id: string; name: string }[];
  planModels?: Record<
    string,
    { missingProviders?: string[]; models?: unknown[]; modelCount?: number }
  >;
  availability?: Record<string, boolean>;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [planSummaries, setPlanSummaries] = useState<PlanSummary[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar o dashboard.");
        const data = await readJsonSafe<Stats>(response);
        if (!data) throw new Error("Falha ao carregar o dashboard.");
        return data;
      })
      .then(setStats)
      .catch((fetchError: Error) => setError(fetchError.message));
  }, []);

  useEffect(() => {
    fetch("/api/admin/plans", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await readJsonSafe<PlansPayload>(response);
      })
      .then((data) => {
        if (!data?.plans) return;
        setAvailability(data.availability ?? {});
        setPlanSummaries(
          data.plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            models:
              data.planModels?.[plan.id]?.modelCount ??
              data.planModels?.[plan.id]?.models?.length ??
              0,
            missing: data.planModels?.[plan.id]?.missingProviders ?? [],
          }))
        );
      })
      .catch(() => undefined);
  }, []);

  const maxTokens = Math.max(
    1,
    ...(stats?.daily ?? []).map((item) => item.tokens)
  );

  const brokenPlans = planSummaries.filter((plan) => plan.missing.length > 0);
  const providerList = Object.entries(PROVIDER_LABELS).filter(
    ([provider]) => provider !== "local"
  );

  return (
    <div className="space-y-6">
      <header className="panel flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ dashboard ]
          </h1>
          <p className="text-muted mt-1 text-[12.5px]">
            Visao geral da operacao NEXUS: operadores, planos, provedores e
            consumo de tokens.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/plans/" className="btn btn-xs btn-primary">
            planos
          </Link>
          <Link href="/admin/providers/" className="btn btn-xs">
            provedores
          </Link>
        </div>
      </header>

      {error ? (
        <p className="panel border-danger/40 p-3 text-danger text-[12.5px]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "operadores", value: stats?.totals.users ?? 0 },
          { label: "ativos", value: stats?.totals.active ?? 0 },
          { label: "bloqueados", value: stats?.totals.banned ?? 0 },
          { label: "conversas", value: stats?.totals.chats ?? 0 },
          { label: "sessoes", value: stats?.totals.sessions ?? 0 },
          { label: "mensagens", value: stats?.totals.messages ?? 0 },
          { label: "tokens", value: stats?.totals.tokens ?? 0 },
        ].map((card) => (
          <div key={card.label} className="panel p-4">
            <p className="text-muted text-[10.5px] tracking-[0.16em] uppercase">
              {card.label}
            </p>
            <p className="text-neon mt-1 text-xl font-semibold">
              {formatNumber(card.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
              [ saude dos planos ]
            </h2>
            <Link href="/admin/plans/" className="btn btn-xs">
              gerenciar
            </Link>
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {planSummaries.map((plan) => (
              <li
                key={plan.id}
                className="panel-flat flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-neon truncate text-[12.5px]">{plan.name}</p>
                  <p className="text-muted text-[11px]">
                    {plan.models} modelo(s) liberado(s)
                  </p>
                </div>
                <span
                  className={`badge ${
                    plan.missing.length ? "badge-amber" : "badge-neon"
                  }`}
                >
                  {plan.missing.length ? "sem chave" : "ok"}
                </span>
              </li>
            ))}
            {!planSummaries.length ? (
              <li className="text-muted text-[12.5px]">carregando planos...</li>
            ) : null}
          </ul>

          {brokenPlans.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-amber text-[11.5px] tracking-[0.16em] uppercase">
                planos sem provedores configurados
              </p>
              <ul className="text-muted mt-2 space-y-1 text-[12px]">
                {brokenPlans.map((plan) => (
                  <li key={plan.id}>
                    <span className="text-amber">{plan.name}</span>: sem chave de{" "}
                    {plan.missing.join(", ")} - o plano entrega apenas o NEXUS
                    Core local. Cadastre em{" "}
                    <span className="text-neon">{"Admin > Provedores"}</span>.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="panel p-5">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            [ provedores ]
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {providerList.map(([id, label]) => {
              const configured = availability[id] ?? false;
              return (
                <li
                  key={id}
                  className="panel-flat flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
                    <span
                      className={`inline-block size-2 shrink-0 rounded-full ${
                        configured ? "bg-neon" : "bg-line"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span
                    className={`badge ${
                      configured ? "badge-neon" : "badge-muted"
                    }`}
                  >
                    {configured ? "chave ok" : "sem chave"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="panel p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          [ consumo diario - 30 dias ]
        </h2>
        <div className="mt-4 flex h-40 items-end gap-1">
          {(stats?.daily ?? []).map((item) => (
            <div
              key={item.day}
              className="group relative flex-1 rounded-t bg-neon/25 hover:bg-neon/50"
              style={{
                height: `${Math.max(4, (item.tokens / maxTokens) * 100)}%`,
              }}
              title={`${item.day}: ${formatNumber(item.tokens)} tokens / ${item.requests} requisicoes`}
            >
              <span className="text-muted pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[10px] group-hover:block">
                {formatNumber(item.tokens)}
              </span>
            </div>
          ))}
          {!stats?.daily.length ? (
            <p className="text-muted text-[12.5px]">sem dados ainda</p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            [ uso por provedor ]
          </h2>
          <table className="mt-3">
            <thead>
              <tr>
                <th>provedor</th>
                <th>requisicoes</th>
                <th>tokens</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.byProvider ?? []).map((row) => (
                <tr key={row.provider}>
                  <td className="text-neon">
                    {PROVIDER_LABELS[
                      row.provider as keyof typeof PROVIDER_LABELS
                    ] ?? row.provider}
                  </td>
                  <td>{formatNumber(row.requests)}</td>
                  <td>{formatNumber(row.tokens)}</td>
                </tr>
              ))}
              {!stats?.byProvider.length ? (
                <tr>
                  <td colSpan={3} className="text-muted">
                    sem requisicoes registradas
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="panel p-5">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            [ top operadores ]
          </h2>
          <table className="mt-3">
            <thead>
              <tr>
                <th>operador</th>
                <th>plano</th>
                <th>tokens</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.topUsers ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.email}</td>
                  <td className="text-muted">{row.plan_id}</td>
                  <td>{formatNumber(row.tokens_used)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          [ novos operadores ]
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>e-mail</th>
                <th>papel</th>
                <th>plano</th>
                <th>status</th>
                <th>criado</th>
                <th>ultimo acesso</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentUsers ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="text-neon">{row.email}</td>
                  <td>{row.role}</td>
                  <td>{row.plan_id}</td>
                  <td>
                    <span
                      className={`badge ${
                        row.status === "active" ? "badge-neon" : "badge-danger"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="text-muted">{formatDateTime(row.created_at)}</td>
                  <td className="text-muted">
                    {row.last_login_at ? formatDateTime(row.last_login_at) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
