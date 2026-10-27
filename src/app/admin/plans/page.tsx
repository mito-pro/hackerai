"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency, formatNumber, readJsonSafe } from "@/lib/utils";
import { PLAN_CAPABILITIES, type PlanCapability } from "@/lib/capabilities";

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
  priority: number;
  isDefault: boolean;
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
  const [form, setForm] = useState<Plan>(EMPTY);
  const [features, setFeatures] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/plans", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setPlans(data.plans ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function edit(plan: Plan) {
    setForm(plan);
    setFeatures(plan.features.join("\n"));
    setMessage("");
  }

  function reset() {
    setForm(EMPTY);
    setFeatures("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
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
    const response = await fetch("/api/admin/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Falha ao salvar o plano.");
      return;
    }
    setMessage("plano salvo.");
    reset();
    await load();
  }

  async function remove(id: string) {
    setMessage("");
    const response = await fetch(`/api/admin/plans?id=${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Falha ao remover.");
      return;
    }
    setMessage("plano removido.");
    await load();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <header>
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ planos ]
          </h1>
          <p className="text-muted text-[12.5px]">
            Cada plano define cota mensal de tokens, limite diario e contexto.
          </p>
        </header>

        {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}

        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-neon tracking-[0.2em]">{plan.name}</p>
                  <p className="text-muted text-[12px]">{plan.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {plan.isDefault ? (
                    <span className="badge badge-neon">padrao</span>
                  ) : null}
                  {plan.category ? (
                    <span className="badge badge-amber">{plan.category}</span>
                  ) : null}
                  <button type="button" className="btn btn-xs" onClick={() => edit(plan)}>
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
            </div>
          ))}
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
          <button type="submit" className="btn btn-primary flex-1">
            salvar plano
          </button>
          <button type="button" className="btn" onClick={reset}>
            limpar
          </button>
        </div>
      </form>
    </div>
  );
}
