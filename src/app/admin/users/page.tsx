"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime, formatNumber, readJsonSafe } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  planId: string;
  status: string;
  tokensUsed: number;
  messagesToday: number;
  tokenOverride: number | null;
  createdAt: string;
  lastLoginAt: string | null;
  requests: number;
};

type PlanOption = { id: string; name: string; monthlyTokens: number };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (!response.ok) return;
    const data = await readJsonSafe<{
      users?: AdminUser[];
      plans?: PlanOption[];
    }>(response);
    if (!data) return;
    setUsers(data.users ?? []);
    setPlans(data.plans ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.name.toLowerCase().includes(term)
    );
  }, [users, search]);

  async function patch(id: string, action: string, value?: string | number | null) {
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, value }),
    });
    const data = await readJsonSafe<{ message?: string }>(response);
    if (!response.ok) {
      setMessage(data?.message ?? "Falha na operacao.");
      return;
    }
    setMessage("operacao aplicada.");
    await load();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ usuarios ]
          </h1>
          <p className="text-muted text-[12.5px]">
            {users.length} operador(es) registrado(s).
          </p>
        </div>
        <input
          className="input w-full max-w-xs"
          placeholder="buscar por e-mail ou nome..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}

      <div className="panel overflow-x-auto p-4">
        <table>
          <thead>
            <tr>
              <th>operador</th>
              <th>papel</th>
              <th>plano</th>
              <th>tokens</th>
              <th>mensagens</th>
              <th>cota extra</th>
              <th>status</th>
              <th>acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id}>
                <td>
                  <p className="text-neon">{user.email}</p>
                  <p className="text-muted text-[11.5px]">
                    {user.name} :: {formatDateTime(user.createdAt)}
                  </p>
                </td>
                <td>
                  <button
                    type="button"
                    className={`badge ${
                      user.role === "admin" ? "badge-amber" : "badge-muted"
                    }`}
                    onClick={() =>
                      patch(user.id, "set_role", user.role === "admin" ? "user" : "admin")
                    }
                  >
                    {user.role}
                  </button>
                </td>
                <td>
                  <select
                    className="input w-auto py-1 text-[12px]"
                    value={user.planId}
                    onChange={(event) => patch(user.id, "set_plan", event.target.value)}
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {formatNumber(user.tokensUsed)}
                  <p className="text-muted text-[11px]">{user.requests} req</p>
                </td>
                <td>{user.messagesToday}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <input
                      className="input w-24 py-1 text-[12px]"
                      placeholder="padrao"
                      value={
                        overrides[user.id] ??
                        (user.tokenOverride === null
                          ? ""
                          : String(user.tokenOverride))
                      }
                      onChange={(event) =>
                        setOverrides((current) => ({
                          ...current,
                          [user.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => {
                        const raw = overrides[user.id];
                        patch(
                          user.id,
                          "set_token_override",
                          raw === undefined || raw === "" ? null : Number(raw)
                        );
                      }}
                    >
                      ok
                    </button>
                  </div>
                </td>
                <td>
                  <span
                    className={`badge ${
                      user.status === "active" ? "badge-neon" : "badge-danger"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => patch(user.id, "reset_usage")}
                    >
                      zerar
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-danger"
                      onClick={() =>
                        patch(
                          user.id,
                          "set_status",
                          user.status === "active" ? "banned" : "active"
                        )
                      }
                    >
                      {user.status === "active" ? "banir" : "reativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={8} className="text-muted">
                  nenhum usuario encontrado
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
