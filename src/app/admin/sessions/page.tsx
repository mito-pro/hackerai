"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime, formatRelative } from "@/lib/utils";

type AdminSession = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
};

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/sessions", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setSessions(data.sessions ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(id: string) {
    setMessage("");
    const response = await fetch(`/api/admin/sessions?id=${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Falha ao revogar.");
      return;
    }
    setMessage("sessao revogada.");
    await load();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
          [ sessoes ]
        </h1>
        <p className="text-muted text-[12.5px]">
          Sessoes ativas (cookies httpOnly). Revogar encerra o acesso na hora.
        </p>
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}

      <div className="panel overflow-x-auto p-4">
        <table>
          <thead>
            <tr>
              <th>operador</th>
              <th>papel</th>
              <th>user-agent</th>
              <th>criada</th>
              <th>expira</th>
              <th>acoes</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td className="text-neon">{session.email}</td>
                <td>
                  <span
                    className={`badge ${
                      session.role === "admin" ? "badge-amber" : "badge-muted"
                    }`}
                  >
                    {session.role}
                  </span>
                </td>
                <td className="text-muted max-w-xs truncate text-[11.5px]">
                  {session.user_agent ?? "-"}
                </td>
                <td className="text-muted">
                  {formatDateTime(session.created_at)}
                  <p className="text-[11px]">
                    {formatRelative(session.created_at)}
                  </p>
                </td>
                <td className="text-muted">
                  {formatDateTime(session.expires_at)}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-xs btn-danger"
                    onClick={() => revoke(session.id)}
                  >
                    revogar
                  </button>
                </td>
              </tr>
            ))}
            {!sessions.length ? (
              <tr>
                <td colSpan={6} className="text-muted">
                  nenhuma sessao ativa
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
