"use client";

import { useEffect, useState } from "react";

type Settings = {
  providers: {
    groq: { configured: boolean; masked: string };
    google: { configured: boolean; masked: string };
    openrouter: { configured: boolean; masked: string };
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
};

export default function AdminProvidersPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({
    groq: "",
    google: "",
    openrouter: "",
    ollamaBaseUrl: "",
    ollamaModel: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpSecure: false,
    mailFrom: "",
    appHost: "",
  });
  const [message, setMessage] = useState("");
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
        }));
      })
      .catch(() => setMessage("Falha ao carregar as configuracoes."));
  }, []);

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
      setMessage(data.message ?? "Falha ao salvar.");
      return;
    }
    setMessage("configuracoes salvas.");
    setForm((current) => ({
      ...current,
      groq: "",
      google: "",
      openrouter: "",
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

  async function clearKey(provider: "groq" | "google" | "openrouter") {
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
      <header>
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
          [ provedores ]
        </h1>
        <p className="text-muted text-[12.5px]">
          Chaves de APIs gratuitas e senha do SMTP. Armazenadas com AES-256-GCM
          no banco (as variaveis de ambiente tambem sao lidas como fallback).
        </p>
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}

      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-3 p-5">
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            groq :: free tier
          </h2>
          <p className="text-muted text-[12px]">
            console.groq.com/keys :: Llama 3.3 70B e 3.1 8B
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
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            google ai studio :: free tier
          </h2>
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
          <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
            openrouter :: modelos free
          </h2>
          <p className="text-muted text-[12px]">
            openrouter.ai/keys :: sufixo :free
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

        <div className="lg:col-span-2">
          <button type="submit" className="btn btn-primary">
            salvar configuracoes
          </button>
        </div>
      </form>
    </div>
  );
}
