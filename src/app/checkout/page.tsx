"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, readJsonSafe } from "@/lib/utils";

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
  capabilities: string[];
  providers: string[];
  priority: number;
  isDefault: boolean;
};

type PixConfig = { pixKey: string };

const PIX_KEY_DISPLAY = "pb-pagamentos@jim.com";

export default function CheckoutPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pixConfig, setPixConfig] = useState<PixConfig | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const pixKey = pixConfig?.pixKey || PIX_KEY_DISPLAY;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [plansRes, pixRes] = await Promise.all([
        fetch("/api/plans", { cache: "no-store" }),
        fetch("/api/admin/settings", { cache: "no-store" }),
      ]);
      const plansData = await readJsonSafe<{ plans?: Plan[] }>(plansRes);
      const pixData = await readJsonSafe<PixConfig>(pixRes);
      setPlans(plansData?.plans ?? []);
      setPixConfig(pixData ?? null);
    } catch {
      setError("Falha ao carregar planos.");
    } finally {
      setLoading(false);
    }
  }

  function choose(plan: Plan) {
    setSelected(plan);
    setMessage("");
    setError("");
  }

  async function copyPix() {
    await navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function createPayment() {
    if (!selected) return;
    if (!pixKey) {
      setError("Chave PIX nao configurada. Contate o administrador.");
      return;
    }
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selected.id, pixKey }),
      });
      const data = await readJsonSafe<{ ok?: boolean; payment?: { id: string; status: string }; error?: string; message?: string }>(res);
      if (!res.ok) {
        setError(data?.error || data?.message || "Falha ao criar pagamento.");
        return;
      }
      setMessage(
        `Pagamento criado para o plano ${selected.name} (R$ ${selected.price.toFixed(2)}). Pague usando a chave PIX acima e aguarde o codigo de ativacao por e-mail.`
      );
      setTimeout(() => router.push("/ativar-plano/"), 1500);
    } catch {
      setError("Falha de rede ao criar pagamento.");
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

  return (
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-neon text-3xl tracking-[0.2em] uppercase mb-2">
            [ escolher plano ]
          </h1>
          <p className="text-muted text-[13px]">
            Selecione o plano, pague via PIX com a chave abaixo e o
            administrador libera o acesso por e-mail (Gmail/SMTP).
          </p>
        </header>

        {error ? (
          <p className="mb-4 p-3 text-danger text-[12.5px] border border-danger/20 bg-danger/5 rounded">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 p-3 text-neon text-[12.5px] border border-neon/20 bg-neon/5 rounded">
            {message}
          </p>
        ) : null}

        {/* Chave PIX em destaque no topo */}
        <section className="mb-8 panel p-5 border border-neon/40">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-neon text-xs tracking-[0.2em] uppercase mb-1">
                chave pix para pagamento
              </p>
              <p className="text-neon text-2xl font-mono font-bold break-all">
                {pixKey}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-xs btn-neon"
              onClick={copyPix}
            >
              {copied ? "copiado!" : "copiar chave"}
            </button>
          </div>
          <p className="text-muted text-[11.5px]">
            Pague qualquer valor para o plano selecionado usando esta chave
            PIX. Depois aguarde o codigo de ativacao no seu e-mail.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selected?.id === plan.id;
            return (
              <article
                key={plan.id}
                className={`panel p-5 cursor-pointer transition ${
                  isSelected
                    ? "border-neon/60 ring-1 ring-neon"
                    : ""
                }`}
                onClick={() => choose(plan)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-neon text-lg font-semibold tracking-[0.15em]">
                      {plan.name}
                    </p>
                    {plan.category ? (
                      <span className="badge badge-amber text-[10px] mt-1 inline-block">
                        {plan.category}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-neon text-xl font-mono">
                    R$ {plan.price.toFixed(2)}
                  </span>
                </div>
                <p className="text-muted text-[12px] mb-3 line-clamp-2">
                  {plan.description}
                </p>
                <div className="space-y-1 text-[11px] text-muted mb-4">
                  <span>{formatCurrency(plan.monthlyTokens)} tokens/mes</span>
                  <span>{plan.dailyMessages} msg/dia</span>
                  <span>ctx {plan.maxContext.toLocaleString()}</span>
                  <span>
                    hist {plan.historyDays ? plan.historyDays + "d" : "∞"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {plan.features.slice(0, 4).map((f) => (
                    <span key={f} className="badge badge-muted text-[10px]">
                      {f}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className={`w-full py-2 text-[12px] tracking-wider uppercase transition ${
                    isSelected
                      ? "bg-neon text-[#050507] font-bold"
                      : "bg-[#11111a] border border-line text-text hover:bg-[#1a1a24]"
                  }`}
                  disabled={isSelected}
                >
                  {isSelected ? "selecionado" : "selecionar"}
                </button>
              </article>
            );
          })}
        </div>

        {selected && (
          <section className="mt-8 panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-neon text-lg tracking-[0.15em] uppercase mb-1">
                  pagamento :: {selected.name}
                </h2>
                <p className="text-muted text-[12px]">
                  R$ {selected.price.toFixed(2)} • PIX
                </p>
              </div>
              <span className="badge badge-neon text-[11px]">
                aguardando pagamento
              </span>
            </div>

            <div className="border border-neon/30 rounded-lg p-4 mb-4">
              <p className="text-neon text-xs tracking-[0.2em] uppercase mb-2">
                pague com esta chave
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-neon text-xl font-mono font-bold break-all">
                  {pixKey}
                </p>
                <button
                  type="button"
                  className="btn btn-xs btn-neon"
                  onClick={copyPix}
                >
                  {copied ? "copiado!" : "copiar"}
                </button>
              </div>
              <p className="text-muted mt-2 text-[11.5px]">
                Chave PIX: <span className="text-neon">{pixKey}</span>. Use seu
                app bancario para pagar via PIX.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary w-full py-3 text-sm tracking-wider uppercase"
              disabled={creating}
              onClick={createPayment}
            >
              {creating ? "gerando pagamento..." : "gerar pagamento PIX"}
            </button>
            <p className="text-muted mt-2 text-[11.5px]">
              apos o pagamento, aguarde o administrador enviar o codigo de
              ativacao para o seu e-mail cadastrado.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
