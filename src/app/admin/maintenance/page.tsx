"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type MaintenanceState = {
  enabled: boolean;
  message: string;
};

const BLOCKED_ROUTES = [
  "/api/chat (envio de mensagens)",
  "/api/chats (historico)",
  "/api/files (upload e download)",
  "/api/generate-image",
  "/api/generate-audio",
];

export default function AdminMaintenancePage() {
  const [state, setState] = useState<MaintenanceState>({
    enabled: false,
    message: "Sistema em manutencao. Tente novamente em alguns minutos.",
  });
  const [form, setForm] = useState({ enabled: false, message: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await readJsonSafe<{
        maintenance?: MaintenanceState;
        message?: string;
      }>(response);
      if (!response.ok) {
        setError(data?.message ?? "Falha ao carregar o estado da manutencao.");
        return;
      }
      if (!data?.maintenance) {
        setError("Resposta invalida do servidor.");
        return;
      }
      setState(data.maintenance);
      setForm({
        enabled: data.maintenance.enabled,
        message: data.maintenance.message,
      });
    } catch {
      setError("Falha de rede ao carregar o estado da manutencao.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceEnabled: form.enabled,
          maintenanceMessage: form.message,
        }),
      });
      const data = await readJsonSafe<{ message?: string }>(response);
      if (!response.ok) {
        setError(data?.message ?? "Falha ao salvar.");
        return;
      }
      setMessage("manutencao atualizada.");
      await load();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const next = !state.enabled;
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceEnabled: next }),
      });
      const data = await readJsonSafe<{ message?: string }>(response);
      if (!response.ok) {
        setError(data?.message ?? "Falha ao alternar manutencao.");
        return;
      }
      setMessage(
        next
          ? "manutencao ATIVADA. Usuarios comuns estao bloqueados."
          : "manutencao desativada. Acesso liberado."
      );
      await load();
    } catch {
      setError("Falha de rede ao alternar manutencao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
          [ manutencao ]
        </h1>
        <p className="text-muted text-[12.5px]">
          Quando ativa, apenas administradores acessam o sistema. Usuarios
          comuns veem a pagina de manutencao em /maintenance e recebem erro 503
          nas rotas bloqueadas.
        </p>
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}
      {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}

      <section className="panel space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-neon text-sm">estado atual</p>
            <p className="text-muted text-[12.5px]">
              {state.enabled
                ? "SISTEMA EM MANUTENCAO — usuarios bloqueados."
                : "SISTEMA OPERACIONAL — todos podem acessar."}
            </p>
          </div>
          <span
            className={`badge ${state.enabled ? "badge-danger" : "badge-neon"}`}
          >
            {state.enabled ? "manutencao ativa" : "operacional"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-xs ${state.enabled ? "btn-danger" : "btn-primary"}`}
            onClick={toggle}
            disabled={loading}
          >
            {loading
              ? "processando..."
              : state.enabled
                ? "desativar manutencao"
                : "ativar manutencao"}
          </button>
          <Link href="/maintenance/" className="btn btn-xs" target="_blank">
            ver pagina publica
          </Link>
        </div>
      </section>

      <form onSubmit={save} className="panel space-y-4 p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          mensagem de manutencao
        </h2>
        <div>
          <label className="label">texto exibido aos usuarios</label>
          <textarea
            className="input resize-none"
            rows={3}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            placeholder="Sistema em manutencao. Tente novamente em alguns minutos."
          />
        </div>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          />
          manutencao ativa
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "salvando..." : "salvar configuracoes"}
        </button>
      </form>

      <section className="panel p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          rotas bloqueadas durante a manutencao
        </h2>
        <ul className="text-muted mt-3 space-y-1 text-[12.5px]">
          {BLOCKED_ROUTES.map((route) => (
            <li key={route}>:: {route}</li>
          ))}
        </ul>
        <p className="text-muted mt-4 text-[11.5px]">
          Login, painel admin e rotas /api/admin/* continuam disponiveis para o
          administrador.
        </p>
      </section>
    </div>
  );
}
