"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime, readJsonSafe } from "@/lib/utils";

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_email: string | null;
  details: string | null;
  ip: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "user.create": "conta criada",
  "user.plan_change": "plano alterado",
  "user.role_change": "papel alterado",
  "user.token_override": "cota extra",
  "user.reset_usage": "consumo zerado",
  "user.ban": "banido",
  "user.unban": "desbanido",
  "plan.create": "plano criado",
  "plan.update": "plano atualizado",
  "plan.delete": "plano removido",
  "settings.update": "configuracoes",
  "maintenance.toggle": "manutencao",
  "provider.update": "provedor",
  "session.revoke": "sessao revogada",
  "chat.delete": "conversa removida",
  "omega.setup": "omega setup",
  "omega.decensor": "omega decensor",
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    params.set("limit", "300");
    const response = await fetch(`/api/admin/audit?${params}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await readJsonSafe<{ logs?: AuditLog[] }>(response);
    setLogs(data?.logs ?? []);
  }, [actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = logs.filter((log) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      log.actor_email.toLowerCase().includes(term) ||
      (log.target_email ?? "").toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ auditoria ]
          </h1>
          <p className="text-muted text-[12.5px]">
            Historico de acoes administrativas e mudancas de plano.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input w-full max-w-xs"
            placeholder="buscar por e-mail ou acao..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="input w-auto py-1 text-[12px]"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          >
            <option value="">todas acoes</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="panel overflow-x-auto p-4">
        <table>
          <thead>
            <tr>
              <th>data</th>
              <th>acao</th>
              <th>autor</th>
              <th>alvo</th>
              <th>detalhes</th>
              <th>ip</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td className="text-muted whitespace-nowrap">
                  {formatDateTime(log.created_at)}
                </td>
                <td>
                  <span className="badge badge-neon">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </td>
                <td className="text-neon">{log.actor_email}</td>
                <td className="text-muted">
                  {log.target_email ?? log.target_id ?? "-"}
                </td>
                <td className="text-muted max-w-xs truncate text-[11.5px]">
                  {log.details ?? "-"}
                </td>
                <td className="text-muted text-[11px]">{log.ip ?? "-"}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={6} className="text-muted">
                  nenhum registro encontrado
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
