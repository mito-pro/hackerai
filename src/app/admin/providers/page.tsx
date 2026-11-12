"use client";

import { useEffect, useMemo, useState } from "react";

type ProviderStatus = { configured: boolean; masked: string };

type PlanSummary = { id: string; name: string; providers?: string[] };

type Settings = {
  providers: {
    groq: ProviderStatus;
    google: ProviderStatus;
    openrouter: ProviderStatus;
    cerebras: ProviderStatus;
    sambanova: ProviderStatus;
    nvidia: ProviderStatus;
    opencode: ProviderStatus;
    vercel: ProviderStatus;
    runapi: ProviderStatus;
    ollama: { configured: boolean; baseUrl: string; model: string };
  };
  otp: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpFrom: string;
    smtpSecure: boolean;
    hasPassword: boolean;
    appHost: string;
  };
  pixKey: string;
};

export default function AdminProvidersPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [form, setForm] = useState({
    groq: "",
    google: "",
    openrouter: "",
    cerebras: "",
    sambanova: "",
    nvidia: "",
    opencode: "",
    vercel: "",
    runapi: "",
    ollamaBaseUrl: "",
    ollamaModel: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpSecure: false,
    mailFrom: "",
    appHost: "",
    pixKey: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tests, setTests] = useState<Record<string, string>>({});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar.");
        return await response.json();
      })
      .then((data: Settings) => {
        setSettings(data);
        setForm((current) => ({
          ...current,
          ollamaBaseUrl: data.providers.ollama.baseUrl,
          ollamaModel: data.providers.ollama.model,
          smtpHost: data.otp.smtpHost,
          smtpPort: data.otp.smtpPort,
          smtpUser: data.otp.smtpUser,
          smtpSecure: data.otp.smtpSecure,
          mailFrom: data.otp.smtpFrom,
          appHost: data.otp.appHost,
          pixKey: data.pixKey ?? "",
        }));
      })
      .catch(() => setError("Falha ao carregar as configuracoes."));

    fetch("/api/admin/plans", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json();
      })
      .then((data: { plans?: PlanSummary[] } | null) => {
        setPlans(data?.plans ?? []);
      })
      .catch(() => undefined);
  }, []);

  const plansByProvider = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const plan of plans) {
      for (const provider of plan.providers ?? []) {
        if (provider === "local") continue;
        const current = map.get(provider) ?? [];
        current.push(plan.name);
        map.set(provider, current);
      }
    }
    return map;
  }, [plans]);

  function plansForProvider(provider: string) {
    return plansByProvider.get(provider) ?? [];
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message ?? "Falha ao salvar.");
      return;
    }
    setError("");
    setMessage("configuracoes salvas.");
    setForm((current) => ({
      ...current,
      groq: "",
      google: "",
      openrouter: "",
      cerebras: "",
      sambanova: "",
      nvidia: "",
      opencode: "",
      vercel: "",
      runapi: "",
      smtpPass: "",
    }));
    const refreshed = await fetch("/api/admin/settings", { cache: "no-store" });
    setSettings(await refreshed.json());
  }

  async function test(provider: string) {
    setTests((current) => ({ ...current, [provider]: "testando..." }));
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        provider === "smtp" ? { provider, email: testEmail } : { provider }
      ),
    });
    const data = await response.json();
    if (provider === "ollama" && Array.isArray(data.models)) {
      setOllamaModels(data.models);
    }
    setTests((current) => ({
      ...current,
      [provider]: data.ok ? data.message : `falhou: ${data.message}`,
    }));
  }

  async function clearKey(
    provider:
      | "groq"
      | "google"
      | "openrouter"
      | "cerebras"
      | "sambanova"
      | "nvidia"
      | "opencode"
      | "vercel"
      | "runapi"
  ) {
    setMessage("");
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearProvider: provider }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Falha ao remover a chave.");
      return;
    }
    setMessage("chave removida.");
    const refreshed = await fetch("/api/admin/settings", { cache: "no-store" });
    setSettings(await refreshed.json());
  }

  return (
    <div className="space-y-5">
      <header className="panel p-5">
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
          [ provedores ]
        </h1>
        <p className="text-muted mt-1 text-[12.5px]">
          Chaves de APIs gratuitas e senha do SMTP. Armazenadas com AES-256-GCM
          no banco (as variaveis de ambiente tambem sao lidas como fallback).
        </p>
        <p className="text-muted mt-2 text-[11.5px]">
          Cada plano usa apenas os provedores liberados em{" "}
          <span className="text-neon">{"Admin > Planos"}</span>. Sem chave, o
          provedor fica marcado e o plano usa o NEXUS Core local.
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

      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
              groq :: free tier
            </h2>
            <span
              className={`badge ${
                settings?.providers.groq.configured ? "badge-neon" : "badge-danger"
              }`}
            >
              {settings?.providers.groq.configured ? "chave ativa" : "sem chave"}
            </span>
          </div>
          <p className="text-muted text-[12px]">
            console.groq.com/keys :: Llama 3.3 70B e 3.1 8B
          </p>
          <p className="text-muted text-[11.5px]">
            planos que usam este provedor:{" "}
            {plansForProvider("groq").join(", ") || "nenhum"}
          </p>
          <div>
            <label className="label">api key</label>
            <input
              className="input"
              type="password"
              placeholder={
                settings?.providers.groq.configured
                  ? `ativa (${settings.providers.groq.masked})`
                  : "gsk_..."
              }
              value={form.groq}
              onChange={(event) =>
                setForm({ ...form, groq: event.target.value })
              }
            />
          </div>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => test("groq")}
          >
            testar conexao
          </button>
          <button
            type="button"
            className="btn btn-xs btn-danger"
            onClick={() => clearKey("groq")}
            disabled={!settings?.providers.groq.configured}
          >
            remover chave
          </button>
          {tests.groq ? (
            <p className="text-muted text-[12px]">{tests.groq}</p>
          ) : null}
        </section>

        <section className="panel space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
              google ai studio :: free tier
            </h2>
            <span
              className={`badge ${
                settings?.providers.google.configured
                  ? "badge-neon"
                  : "badge-danger"
              }`}
            >
              {settings?.providers.google.configured
                ? "chave ativa"
                : "sem chave"}
            </span>
          </div>
          <p className="text-muted text-[12px]">
            aistudio.google.com :: Gemini 2.0 Flash
          </p>
          <div>
            <label className="label">api key</label>
            <input
              className="input"
              type="password"
              placeholder={
                settings?.providers.google.configured
                  ? `ativa (${settings.providers.google.masked})`
                  : "AIza..."
              }
              value={form.google}
              onChange={(event) =>
                setForm({ ...form, google: event.target.value })
              }
            />
          </div>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => test("google")}
          >
            testar conexao
          </button>
          <button
            type="button"
            className="btn btn-xs btn-danger"
            onClick={() => clearKey("google")}
            disabled={!settings?.providers.google.configured}
          >
            remover chave
          </button>
          {tests.google ? (
            <p className="text-muted text-[12px]">{tests.google}</p>
          ) : null}
        </section>

        <section className="panel space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
              openrouter :: modelos free
            </h2>
            <span
              className={`badge ${
                settings?.providers.openrouter.configured
                  ? "badge-neon"
                  : "badge-danger"
              }`}
            >
              {settings?.providers.openrouter.configured
                ? "chave ativa"
                : "sem chave"}
            </span>
          </div>
          <p className="text-muted text-[12px]">
            openrouter.ai/keys :: sufixo :free
          </p>
          <p className="text-muted text-[11.5px]">
            planos que usam este provedor:{" "}
            {plansForProvider("openrouter").join(", ") || "nenhum"}
          </p>
          <div>
            <label className="label">api key</label>
            <input
              className="input"
              type="password"
              placeholder={
                settings?.providers.openrouter.configured
                  ? `ativa (${settings.providers.openrouter.masked})`
                  : "sk-or-v1-..."
              }
              value={form.openrouter}
              onChange={(event) =>
                setForm({ ...form, openrouter: event.target.value })
              }
            />
          </div>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => test("openrouter")}
          >
            testar conexao
          </button>
          <button
            type="button"
            className="btn btn-xs btn-danger"
            onClick={() => clearKey("openrouter")}
            disabled={!settings?.providers.openrouter.configured}
          >
            remover chave
          </button>
          {tests.openrouter ? (
            <p className="text-muted text-[12px]">{tests.openrouter}</p>
          ) : null}
        </section>

        <CompatibleProviderCard
          title="Cerebras :: free tier"
          hint="cloud.cerebras.ai :: Llama 3.3 70B e Qwen3 32B"
          plans={plansForProvider("cerebras")}
          value={form.cerebras}
          configured={settings?.providers.cerebras.configured ?? false}
          masked={settings?.providers.cerebras.masked ?? ""}
          testResult={tests.cerebras}
          onChange={(value) => setForm({ ...form, cerebras: value })}
          onTest={() => test("cerebras")}
          onClear={() => clearKey("cerebras")}
        />

        <CompatibleProviderCard
          title="SambaNova :: free tier"
          hint="sambanova.ai :: developer tier :: Llama e Qwen"
          plans={plansForProvider("sambanova")}
          value={form.sambanova}
          configured={settings?.providers.sambanova.configured ?? false}
          masked={settings?.providers.sambanova.masked ?? ""}
          testResult={tests.sambanova}
          onChange={(value) => setForm({ ...form, sambanova: value })}
          onTest={() => test("sambanova")}
          onClear={() => clearKey("sambanova")}
        />

        <CompatibleProviderCard
          title="NVIDIA NIM :: creditos gratis"
          hint="build.nvidia.com :: Nemotron, Llama e Qwen"
          plans={plansForProvider("nvidia")}
          value={form.nvidia}
          configured={settings?.providers.nvidia.configured ?? false}
          masked={settings?.providers.nvidia.masked ?? ""}
          testResult={tests.nvidia}
          onChange={(value) => setForm({ ...form, nvidia: value })}
          onTest={() => test("nvidia")}
          onClear={() => clearKey("nvidia")}
        />

        <CompatibleProviderCard
          title="OpenCode Console :: free tier"
          hint="opencode.ai/console :: modelos gratuitos (big-pickle, GLM, DeepSeek)"
          plans={plansForProvider("opencode")}
          value={form.opencode}
          configured={settings?.providers.opencode.configured ?? false}
          masked={settings?.providers.opencode.masked ?? ""}
          testResult={tests.opencode}
          onChange={(value) => setForm({ ...form, opencode: value })}
          onTest={() => test("opencode")}
          onClear={() => clearKey("opencode")}
        />

        <CompatibleProviderCard
          title="Vercel AI Gateway :: modelos premium"
          hint="ai-gateway.vercel.sh :: Claude, GPT, Gemini, Grok e Kimi"
          plans={plansForProvider("vercel")}
          value={form.vercel}
          configured={settings?.providers.vercel.configured ?? false}
          masked={settings?.providers.vercel.masked ?? ""}
          testResult={tests.vercel}
          onChange={(value) => setForm({ ...form, vercel: value })}
          onTest={() => test("vercel")}
          onClear={() => clearKey("vercel")}
        />

        <CompatibleProviderCard
          title="RunAPI :: video, imagem e audio"
          hint="runapi.ai :: Kling v2/v3 (video), GPT Image 2, Nano Banana (imagem), Minimax e ElevenLabs (audio)"
          plans={plansForProvider("runapi")}
          value={form.runapi}
          configured={settings?.providers.runapi.configured ?? false}
          masked={settings?.providers.runapi.masked ?? ""}
          testResult={tests.runapi}
          onChange={(value) => setForm({ ...form, runapi: value })}
          onTest={() => test("runapi")}
          onClear={() => clearKey("runapi")}
        />

        <section className="panel space-y-3 p-5">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            ollama :: 100% offline
          </h2>
          <p className="text-muted text-[12px]">
            Rode `ollama serve` e informe a base URL da API. O modelo abaixo e o
            usado pelo seletor do chat.
          </p>
          <div>
            <label className="label">base url</label>
            <input
              className="input"
              value={form.ollamaBaseUrl}
              onChange={(event) =>
                setForm({ ...form, ollamaBaseUrl: event.target.value })
              }
            />
          </div>
          <div>
            <label className="label">modelo padrao</label>
            <input
              className="input"
              list="ollama-models"
              placeholder="llama3.2"
              value={form.ollamaModel}
              onChange={(event) =>
                setForm({ ...form, ollamaModel: event.target.value })
              }
            />
            <datalist id="ollama-models">
              {ollamaModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <p className="text-muted mt-1 text-[11px]">
              Clique em testar conexao para listar os modelos instalados.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => test("ollama")}
          >
            testar conexao
          </button>
          {tests.ollama ? (
            <p className="text-muted text-[12px]">{tests.ollama}</p>
          ) : null}
        </section>

        <section className="panel space-y-3 p-5 lg:col-span-2">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            smtp :: envio do codigo OTP
          </h2>
          <p className="text-muted text-[12px]">
            Sem SMTP o sistema imprime o codigo no console do servidor e o
            exibe na tela em modo de desenvolvimento.
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">host</label>
              <input
                className="input"
                value={form.smtpHost}
                onChange={(event) =>
                  setForm({ ...form, smtpHost: event.target.value })
                }
                placeholder="smtp.host"
              />
            </div>
            <div>
              <label className="label">porta</label>
              <input
                type="number"
                className="input"
                value={form.smtpPort}
                onChange={(event) =>
                  setForm({ ...form, smtpPort: Number(event.target.value) })
                }
              />
            </div>
            <div>
              <label className="label">usuario</label>
              <input
                className="input"
                value={form.smtpUser}
                onChange={(event) =>
                  setForm({ ...form, smtpUser: event.target.value })
                }
              />
            </div>
            <div>
              <label className="label">senha</label>
              <input
                type="password"
                className="input"
                placeholder={
                  settings?.otp.hasPassword ? "cadastrada" : "opcional"
                }
                value={form.smtpPass}
                onChange={(event) =>
                  setForm({ ...form, smtpPass: event.target.value })
                }
              />
            </div>
            <div>
              <label className="label">remetente</label>
              <input
                className="input"
                value={form.mailFrom}
                onChange={(event) =>
                  setForm({ ...form, mailFrom: event.target.value })
                }
                placeholder="NEXUS <no-reply@dominio.com>"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(event) =>
                    setForm({ ...form, smtpSecure: event.target.checked })
                  }
                />
                ssl/tls
              </label>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="label">e-mail de teste</label>
              <input
                className="input"
                type="email"
                placeholder="destino@dominio.com"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => test("smtp")}
            >
              testar smtp
            </button>
          </div>
          {tests.smtp ? (
            <p className="text-muted text-[12px]">{tests.smtp}</p>
          ) : null}
        </section>

        <section className="panel space-y-3 p-5 lg:col-span-2">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            pix :: chave de pagamento
          </h2>
          <p className="text-muted text-[12px]">
            Chave PIX usada pelos usuários para gerar boletos de pagamento de
            planos. Enviada por e-mail após a confirmação do pagamento.
          </p>
          <div>
            <label className="label">chave PIX</label>
            <input
              className="input"
              value={form.pixKey}
              placeholder="ex: empresa@dominio.com ou CNPJ"
              onChange={(event) => setForm({ ...form, pixKey: event.target.value })}
            />
          </div>
          <p className="text-muted text-[11px]">
            essa chave e exibida na tela de checkout para o usuario copiar e
            pagar via PIX.
          </p>
        </section>

        <div className="lg:col-span-2">
          <button type="submit" className="btn btn-primary">
            salvar configuracoes
          </button>
        </div>
      </form>
    </div>
  );
}

function CompatibleProviderCard({
  title,
  hint,
  plans,
  value,
  configured,
  masked,
  testResult,
  onChange,
  onTest,
  onClear,
}: {
  title: string;
  hint: string;
  plans?: string[];
  value: string;
  configured: boolean;
  masked: string;
  testResult?: string;
  onChange: (value: string) => void;
  onTest: () => void;
  onClear: () => void;
}) {
  return (
    <section className="panel space-y-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">{title}</h2>
        <span className={`badge ${configured ? "badge-neon" : "badge-danger"}`}>
          {configured ? "chave ativa" : "sem chave"}
        </span>
      </div>
      <p className="text-muted text-[12px]">{hint}</p>
      {plans?.length ? (
        <p className="text-muted text-[11.5px]">
          planos que usam este provedor:{" "}
          <span className="text-neon/80">{plans.join(", ")}</span>
        </p>
      ) : (
        <p className="text-muted text-[11.5px]">
          nenhum plano usa este provedor no momento
        </p>
      )}
      <div>
        <label className="label">api key</label>
        <input
          className="input"
          type="password"
          placeholder={configured ? `ativa (${masked})` : "cole a chave aqui"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <button type="button" className="btn btn-xs" onClick={onTest}>
        testar conexao
      </button>
      <button
        type="button"
        className="btn btn-xs btn-danger"
        onClick={onClear}
        disabled={!configured}
      >
        remover chave
      </button>
      {testResult ? <p className="text-muted text-[12px]">{testResult}</p> : null}
    </section>
  );
}
