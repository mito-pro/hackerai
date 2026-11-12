"use client";

import { useCallback, useEffect, useState } from "react";

type RepoStatus = {
  path: string;
  present: boolean;
  version: string;
  lockfile: boolean;
  uv: string;
  python: string;
  setupCommand: string;
  decensorCommand: string;
};

type JobStatus = {
  running: boolean;
  job: {
    pid: number;
    model: string;
    outDir: string;
    startedAt: string;
  } | null;
  log: string[];
};

type OmegaStatus = {
  repo: RepoStatus;
  ollama: {
    configured: boolean;
    baseUrl: string;
    error: string;
    models: string[];
    uncensored: string[];
  };
  job: JobStatus;
};

export default function AdminOmegaPage() {
  const [status, setStatus] = useState<OmegaStatus | null>(null);
  const [model, setModel] = useState("Qwen/Qwen3-4B-Instruct-2507");
  const [quantization, setQuantization] = useState("");
  const [command, setCommand] = useState("");
  const [message, setMessage] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/omega", { cache: "no-store" });
      if (!response.ok) return;
      setStatus((await response.json()) as OmegaStatus);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function buildCommand() {
    setMessage("");
    const response = await fetch("/api/admin/omega", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "command", model, quantization }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Falha ao montar o comando.");
      return;
    }
    setCommand(data.command ?? "");
  }

  async function start() {
    setMessage("");
    const response = await fetch("/api/admin/omega", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", model, quantization }),
    });
    const data = await response.json();
    setMessage(data.message ?? (data.ok ? "Job iniciado." : "Falha ao iniciar."));
    await load();
  }

  async function setupRepo() {
    setMessage("");
    setSetupLoading(true);
    try {
      const response = await fetch("/api/admin/omega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup", model, quantization }),
      });
      const data = await response.json();
      const hint = data.hint ? ` (${data.hint})` : "";
      setMessage(
        (data.message ?? (data.ok ? "Repo baixado com sucesso." : "Falha ao baixar o repo.")) + hint
      );
      await load();
    } catch {
      setMessage("Falha ao baixar o repo heretic.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("copiado.");
    } catch {
      setMessage("Nao foi possivel copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
          [ omega :: modo sem censura ]
        </h1>
        <p className="text-muted text-[12.5px]">
          Integra o repo{" "}
          <span className="text-neon">0xSojalSec/Uncensored-AI</span> (Heretic):
          o admin decensorsa um modelo do Hugging Face, importa no Ollama e o
          modelo passa a ser offered no terminal para o plano NEXUS OMEGA.
        </p>
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}

      <section className="panel space-y-3 p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          repo heretic
        </h2>
        <div className="text-muted grid gap-1 text-[12.5px] sm:grid-cols-2">
          <span>
            caminho: <span className="text-text">{status?.repo.path ?? "-"}</span>
          </span>
          <span>
            estado:{" "}
            <span className={status?.repo.present ? "text-neon" : "text-danger"}>
              {status?.repo.present ? "clonado" : "ausente"}
            </span>
          </span>
          <span>versao: {status?.repo.version || "-"}</span>
          <span>uv: {status?.repo.uv || "nao encontrado no PATH"}</span>
          <span>python: {status?.repo.python || "nao encontrado no PATH"}</span>
          <span>lockfile: {status?.repo.lockfile ? "uv.lock ok" : "-"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="panel-flat px-2 py-1 text-[12px]">
            {status?.repo.setupCommand ?? "npm run omega:setup"}
          </code>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => copy(status?.repo.setupCommand ?? "")}
          >
            copiar
          </button>
          <button
            type="button"
            className="btn btn-xs btn-primary"
            onClick={setupRepo}
            disabled={setupLoading || status?.repo.present}
          >
            {setupLoading ? "baixando e iniciando..." : "baixar tudo e iniciar"}
          </button>
          {!status?.repo.present ? (
            <span className="text-amber text-[12px]">
              Rode o comando acima (ou clone o repo em tools/Uncensored-AI).
            </span>
          ) : null}
        </div>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          decensorar modelo
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">modelo no hugging face</label>
            <input
              className="input"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Qwen/Qwen3-4B-Instruct-2507"
            />
          </div>
          <div>
            <label className="label">quantizacao (opcional)</label>
            <select
              className="input"
              value={quantization}
              onChange={(event) => setQuantization(event.target.value)}
            >
              <option value="">padrao (sem quantizacao)</option>
              <option value="bnb_4bit">bnb_4bit (pouca VRAM)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-xs" onClick={buildCommand}>
            montar comando
          </button>
          <button
            type="button"
            className="btn btn-xs btn-primary"
            onClick={start}
            disabled={!status?.repo.present}
          >
            decensorar agora
          </button>
        </div>

        {command ? (
          <div className="panel-flat px-3 py-2">
            <p className="text-muted text-[11px] tracking-[0.14em] uppercase">
              comando
            </p>
            <pre className="mt-1 overflow-x-auto text-[12px] whitespace-pre-wrap">
              {command}
            </pre>
            <button
              type="button"
              className="btn btn-xs mt-2"
              onClick={() => copy(command)}
            >
              copiar comando
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          job em execucao
        </h2>
        {status?.job.running ? (
          <p className="text-neon text-[12.5px]">
            rodando :: {status.job.job?.model} (pid {status.job.job?.pid})
          </p>
        ) : (
          <p className="text-muted text-[12.5px]">
            nenhum processo de decensoracao ativo.
          </p>
        )}
        {status?.job.log.length ? (
          <pre className="panel-flat max-h-72 overflow-auto p-3 text-[11.5px] leading-relaxed">
            {status.job.log.join("\n")}
          </pre>
        ) : null}
        <p className="text-muted text-[11.5px]">
          Ao terminar, importe o modelo no Ollama:{" "}
          <span className="text-neon">npm run omega:ollama -- slug-do-modelo</span>.
        </p>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          modelos omega no ollama
        </h2>
        {!status?.ollama.configured ? (
          <p className="text-muted text-[12.5px]">
            Ollama nao configurado. Defina a base URL em{" "}
            <span className="text-neon">{"Admin > Provedores"}</span>.
          </p>
        ) : status.ollama.error ? (
          <p className="text-danger text-[12.5px]">
            falha ao consultar o Ollama: {status.ollama.error}
          </p>
        ) : status.ollama.uncensored.length ? (
          <ul className="text-neon space-y-1 text-[12.5px]">
            {status.ollama.uncensored.map((tag) => (
              <li key={tag}>- {tag}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-[12.5px]">
            nenhum modelo decensored detectado (tags com heretic, uncensored,
            abliterated ou omega).
          </p>
        )}
      </section>
    </div>
  );
}
