"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatNumber, readJsonSafe } from "@/lib/utils";
import { PLAN_CAPABILITIES, type PlanCapability } from "@/lib/capabilities";
import { planLabel } from "@/lib/model-registry";

type ProviderId =
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
  | "uncensored";

type Plan = {
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

type ProviderInfo = {
  id: string;
  label: string;
  configured: boolean;
  modelCount: number;
};

type PlanModelInfo = {
  providers: ProviderInfo[];
  models: { id: string; label: string; provider: string; type: string }[];
  missingProviders: string[];
  modelCount: number;
};

type PlansPayload = {
  plans?: Plan[];
  planModels?: Record<string, PlanModelInfo>;
  availability?: Record<string, boolean>;
  providerLabels?: Record<string, string>;
  providerIds?: ProviderId[];
};

const EMPTY: Plan = {
  id: "",
  name: "",
  category: "",
  description: "",
  price: 0,
  monthlyTokens: 50_000,
  dailyMessages: 25,
  maxContext: 8_000,
  features: [],
  historyDays: 7,
  capabilities: [],
  providers: ["local"],
  priority: 10,
  isDefault: false,
};

function capabilityLabel(key: PlanCapability) {
  return (
    PLAN_CAPABILITIES.find((capability) => capability.key === key)?.label ?? key
  );
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planModels, setPlanModels] = useState<Record<string, PlanModelInfo>>({});
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [providerLabels, setProviderLabels] = useState<Record<string, string>>({});
  const [providerIds, setProviderIds] = useState<ProviderId[]>([]);
  const [form, setForm] = useState<Plan>(EMPTY);
  const [features, setFeatures] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/plans", { cache: "no-store" });
    if (!response.ok) return;
    const data = await readJsonSafe<PlansPayload>(response);
    if (!data) return;
    setPlans(data.plans ?? []);
    setPlanModels(data.planModels ?? {});
    setAvailability(data.availability ?? {});
    setProviderLabels(data.providerLabels ?? {});
    setProviderIds(data.providerIds ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectableProviders = useMemo(
    () => providerIds.filter((id) => id !== "local"),
    [providerIds]
  );

  function edit(plan: Plan) {
    setForm({ ...plan, providers: plan.providers ?? ["local"] });
    setFeatures(plan.features.join("\n"));
    setMessage("");
    setError("");
    setExpanded(plan.id);
  }

  function reset() {
    setForm(EMPTY);
    setFeatures("");
    setError("");
  }

  function toggleProvider(provider: ProviderId) {
    setForm((current) => {
      const selected = current.providers ?? [];
      const next = selected.includes(provider)
        ? selected.filter((item) => item !== provider)
        : [...selected, provider];
      return { ...current, providers: next };
    });
  }

  function useOnlyConfigured() {
    const configured = selectableProviders.filter(
      (provider) => availability[provider]
    );
    setForm((current) => ({
      ...current,
      providers: configured.length ? ["local", ...configured] : ["local"],
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      monthlyTokens: Number(form.monthlyTokens),
      dailyMessages: Number(form.dailyMessages),
      maxContext: Number(form.maxContext),
      historyDays: Number(form.historyDays),
      priority: Number(form.priority),
      features: features
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJsonSafe<{ message?: string }>(response);
      if (!response.ok) {
        setError(data?.message ?? "Falha ao salvar o plano.");
        return;
      }
      setMessage("plano salvo.");
      reset();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/plans?id=${id}`, {
      method: "DELETE",
    });
    const data = await readJsonSafe<{ message?: string }>(response);
    if (!response.ok) {
      setError(data?.message ?? "Falha ao remover.");
      return;
    }
    setMessage("plano removido.");
    await load();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-4">
        <header className="panel p-5">
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ planos ]
          </h1>
          <p className="text-muted mt-1 text-[12.5px]">
            Cada plano define cota, limite diario, contexto e os provedores que
            liberam os modelos. O NEXUS Core local fica sempre disponivel como
            reserva.
          </p>
        </header>

        {message ? (
          <p className="panel border-neon/40 p-3 text-neon text-[12.5px]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="panel border-danger/40 p-3 text-danger text-[12.5px]">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          {plans.map((plan) => {
            const info = planModels[plan.id];
            const missing = info?.missingProviders ?? [];
            const healthy = missing.length === 0;
            return (
              <article key={plan.id} className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-neon tracking-[0.2em]">{plan.name}</p>
                      {plan.isDefault ? (
                        <span className="badge badge-neon">padrao</span>
                      ) : null}
                      {plan.category ? (
                        <span className="badge badge-amber">{plan.category}</span>
                      ) : null}
                      <span
                        className={`badge ${
                          healthy ? "badge-neon" : "badge-amber"
                        }`}
                      >
                        {info?.modelCount ?? 0} modelo(s)
                      </span>
                    </div>
                    <p className="text-muted mt-1 text-[12px]">
                      {plan.description}
                    </p>
                    <p className="text-muted mt-1 text-[11.5px]">
                      modelos liberados:{" "}
                      <span className="text-neon/80">
                        {planLabel(plan.id, plan.providers)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => edit(plan)}
                    >
                      editar
                    </button>
                    {plan.id !== "free" ? (
                      <button
                        type="button"
                        className="btn btn-xs btn-danger"
                        onClick={() => remove(plan.id)}
                      >
                        remover
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="text-muted mt-3 grid gap-1 text-[12.5px] sm:grid-cols-5">
                  <span>{formatCurrency(plan.price)}/mes</span>
                  <span>{formatNumber(plan.monthlyTokens)} tokens</span>
                  <span>{plan.dailyMessages} msg/dia</span>
                  <span>ctx {formatNumber(plan.maxContext)}</span>
                  <span>
                    hist {plan.historyDays ? `${plan.historyDays}d` : "∞"}
                  </span>
                </div>

                {plan.capabilities.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2 text-[11.5px]">
                    {plan.capabilities.map((capability) => (
                      <li key={capability} className="badge badge-neon">
                        {capabilityLabel(capability)}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {plan.features.length ? (
                  <ul className="text-muted mt-2 flex flex-wrap gap-2 text-[11.5px]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="badge badge-muted">
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-3 border-t border-line pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted text-[11.5px] uppercase">
                      provedores do plano
                    </span>
                    {(info?.providers ?? []).map((provider) => (
                      <span
                        key={provider.id}
                        className={`badge ${
                          provider.configured ? "badge-neon" : "badge-danger"
                        }`}
                        title={
                          provider.configured
                            ? `${provider.modelCount} modelo(s) disponiveis`
                            : "chave ausente: este provedor nao entrega modelos"
                        }
                      >
                        {provider.label}
                        {provider.configured ? "" : " :: sem chave"}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="text-muted">
                      {info?.modelCount ?? 0} modelo(s) liberado(s)
                    </span>
                    {info?.models.length ? (
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() =>
                          setExpanded((current) =>
                            current === plan.id ? null : plan.id
                          )
                        }
                      >
                        {expanded === plan.id ? "esconder modelos" : "ver modelos"}
                      </button>
                    ) : null}
                  </div>

                  {missing.length ? (
                    <p className="text-amber mt-2 text-[11.5px]">
                      ATENCAO: sem chave de {missing.join(", ")} este plano so
                      entrega o NEXUS Core local. Cadastre a chave em{" "}
                      <span className="text-neon">{"Admin > Provedores"}</span>{" "}
                      ou troque os provedores do plano.
                    </p>
                  ) : null}

                  {expanded === plan.id ? (
                    <ul className="text-muted mt-2 grid gap-1 text-[11.5px] sm:grid-cols-2 lg:grid-cols-3">
                      {(info?.models ?? []).map((model) => (
                        <li key={model.id} className="truncate">
                          <span className="text-neon">{model.provider}</span> ::{" "}
                          {model.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <form onSubmit={save} className="panel h-fit space-y-3 p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          {form.id ? `editar :: ${form.name}` : "novo plano"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">nome</label>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">id (opcional)</label>
            <input
              className="input"
              value={form.id}
              onChange={(event) => setForm({ ...form, id: event.target.value })}
              placeholder="gerado automaticamente"
            />
          </div>
        </div>

        <div>
          <label className="label">categoria</label>
          <input
            className="input"
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value })
            }
            placeholder="Premium Elite"
          />
        </div>

        <div>
          <label className="label">descricao</label>
          <input
            className="input"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">preco (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: Number(event.target.value) })
              }
            />
          </div>
          <div>
            <label className="label">tokens/mes</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.monthlyTokens}
              onChange={(event) =>
                setForm({ ...form, monthlyTokens: Number(event.target.value) })
              }
            />
          </div>
          <div>
            <label className="label">mensagens/dia</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.dailyMessages}
              onChange={(event) =>
                setForm({ ...form, dailyMessages: Number(event.target.value) })
              }
            />
          </div>
          <div>
            <label className="label">contexto maximo</label>
            <input
              type="number"
              min="1000"
              className="input"
              value={form.maxContext}
              onChange={(event) =>
                setForm({ ...form, maxContext: Number(event.target.value) })
              }
            />
          </div>
          <div>
            <label className="label">retencao do historico (dias)</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.historyDays}
              onChange={(event) =>
                setForm({ ...form, historyDays: Number(event.target.value) })
              }
            />
            <p className="text-muted mt-1 text-[11px]">0 = ilimitado</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">provedores liberados</label>
            <button
              type="button"
              className="btn btn-xs"
              onClick={useOnlyConfigured}
            >
              so os que tem chave
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectableProviders.map((provider) => {
              const selected = form.providers.includes(provider);
              const configured = availability[provider] ?? false;
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => toggleProvider(provider)}
                  className={`panel-flat flex items-center justify-between gap-2 px-3 py-2 text-left text-[12px] transition ${
                    selected
                      ? "border-neon/50 text-neon"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block size-2.5 rounded-full ${
                        configured ? "bg-neon" : "bg-danger"
                      }`}
                      aria-hidden="true"
                    />
                    {providerLabels[provider] ?? provider}
                  </span>
                  <span className="text-[10.5px] uppercase opacity-70">
                    {selected ? "ativo" : "inativo"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted mt-2 text-[11px]">
            O NEXUS Core local e liberado em todos os planos e nao depende de
            chave. Provedores sem chave ficam marcados em vermelho e nao
            entregam modelos.
          </p>
        </div>

        <div>
          <label className="label">capacidades aplicadas pelo sistema</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLAN_CAPABILITIES.map((capability) => (
              <label
                key={capability.key}
                className="flex items-center gap-2 text-[12.5px]"
              >
                <input
                  type="checkbox"
                  checked={form.capabilities.includes(capability.key)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      capabilities: event.target.checked
                        ? [...form.capabilities, capability.key]
                        : form.capabilities.filter(
                            (item) => item !== capability.key
                          ),
                    })
                  }
                />
                {capability.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">features (uma por linha)</label>
          <textarea
            className="input min-h-24 resize-y"
            value={features}
            onChange={(event) => setFeatures(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) =>
                setForm({ ...form, isDefault: event.target.checked })
              }
            />
            plano padrao
          </label>
          <div>
            <label className="label">prioridade</label>
            <input
              type="number"
              min="0"
              className="input w-28"
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: Number(event.target.value) })
              }
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={saving}
          >
            {saving ? "salvando..." : "salvar plano"}
          </button>
          <button type="button" className="btn" onClick={reset}>
            limpar
          </button>
        </div>
      </form>
    </div>
  );
}
