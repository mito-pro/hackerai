"use client";

import { useCallback, useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type Plan = { id: string; name: string; price: number; monthlyTokens: number; dailyMessages: number; maxContext: number; features: string[]; providers: string[]; description?: string };

export default function PlanChangePage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<{ id: string; name: string } | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [meRes, plansRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/plans", { cache: "no-store" }),
      ]);
      const me = await readJsonSafe<{ user?: { planId: string; planName: string } }>(meRes);
      const plansData = await readJsonSafe<{ plans?: Plan[] }>(plansRes);
      setCurrentPlan(me?.user ? { id: me.user.planId, name: me.user.planName } : null);
      setPlans(plansData?.plans ?? []);
    } catch {
      setError("Falha ao carregar planos.");
    } finally {
      setLoading(false);
    }
  }

  function choose(planId: string) {
    setSelected(planId);
    setMessage("");
    setError("");
  }

  async function requestUpgrade(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!pixKey.trim()) {
      setError("Informe a chave PIX para pagamento.");
      return;
    }
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedPlanId: selected, pixKey: pixKey.trim() }),
      });
      const data = await readJsonSafe<{ ok?: boolean; error?: string; message?: string }>(res);
      if (!res.ok) {
        setError(data?.error || data?.message || "Falha ao solicitar upgrade.");
        return;
      }
      setMessage("Solicitacao de upgrade enviada. O administrador ira analisar e enviar o codigo de ativacao por e-mail.");
      setSelected("");
      setPixKey("");
    } catch {
      setError("Falha de rede ao solicitar upgrade.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] text-[#e8e8f0] flex items-center justify-center">
        <p className="text-neon animate-pulse">carregando planos...</p>
      </div>
    );
  }

  const current = plans.find((p) => p.id === currentPlan?.id);

  return (
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-neon text-2xl tracking-[0.2em] uppercase mb-6">
          [ mudar de plano ]
        </h1>

        {current && (
          <div className="panel p-4 mb-6 border border-amber/40">
            <p className="text-muted text-[12px] mb-1">seu plano atual</p>
            <p className="text-neon text-lg font-bold">{current.name}</p>
          </div>
        )}

        {error ? (
          <p className="mb-4 p-3 text-danger border border-danger/20 bg-danger/5 rounded text-[12.5px]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 p-3 text-neon border border-neon/20 bg-neon/5 rounded text-[12.5px]">
            {message}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = current?.id === plan.id;
            const isSelected = selected === plan.id;
            const isUpgrade = current && plan.id !== current.id;
            return (
              <article
                key={plan.id}
                className={`panel p-5 cursor-pointer transition ${
                  isSelected
                    ? "border-neon/60 ring-1 ring-neon"
                    : isCurrent
                    ? "border-amber/40 ring-1 ring-amber"
                    : ""
                }`}
                onClick={isCurrent ? undefined : () => choose(plan.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className={`text-lg font-semibold tracking-[0.15em] ${isCurrent ? "text-amber" : "text-neon"}`}>
                      {plan.name}
                    </p>
                    {isCurrent ? (
                      <span className="badge badge-amber text-[10px] mt-1 inline-block">atual</span>
                    ) : null}
                    {isUpgrade ? (
                      <span className="badge badge-neon text-[10px] mt-1 inline-block">upgrade</span>
                    ) : null}
                  </div>
                  <span className="text-neon text-xl font-mono">R$ {plan.price.toFixed(2)}</span>
                </div>
                <p className="text-muted text-[12px] mb-3 line-clamp-2">
                  {plan.description}
                </p>
                <div className="space-y-1 text-[11px] text-muted mb-4">
                  <span>{plan.monthlyTokens.toLocaleString("pt-BR")} tokens/mes</span>
                  <span>{plan.dailyMessages} msg/dia</span>
                  <span>ctx {plan.maxContext.toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {plan.features.slice(0, 3).map((f) => (
                    <span key={f} className="badge badge-muted text-[10px]">{f}</span>
                  ))}
                </div>
                {isCurrent ? (
                  <button type="button" className="w-full py-2 text-[11px] text-muted border border-line" disabled>
                    plano atual
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`w-full py-2 text-[11px] tracking-wider uppercase transition ${
                      isSelected
                        ? "bg-neon text-[#050507] font-bold"
                        : "bg-[#11111a] border border-line text-text hover:bg-[#1a1a24]"
                    }`}
                  >
                    {isSelected ? "selecionado" : "selecionar"}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {selected && !plans.find((p) => p.id === current?.id && p.id === selected) && (
          <section className="mt-8 panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-neon text-lg tracking-[0.15em] uppercase mb-1">
                  solicitar upgrade :: {plans.find((p) => p.id === selected)?.name}
                </h2>
                <p className="text-muted text-[12px]">
                  informe a chave PIX para pagamento e aguarde aprovacao do admin
                </p>
              </div>
            </div>

            <div>
              <label className="label text-[12px] block mb-1">chave PIX</label>
              <input
                className="input"
                value={pixKey}
                placeholder="digite sua chave PIX"
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary w-full py-3 text-sm tracking-wider uppercase mt-4"
              disabled={creating || !pixKey.trim()}
              onClick={requestUpgrade}
            >
              {creating ? "enviando solicitacao..." : "solicitar upgrade"}
            </button>
            <p className="text-muted mt-2 text-[11.5px]">
              o administrador vai avaliar e, se aprovado, enviar o codigo de ativacao por e-mail.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
