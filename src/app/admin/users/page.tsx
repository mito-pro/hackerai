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
  const [error, setError] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    planId: "free",
    role: "user" as "user" | "admin",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { id?: string } } | null) => {
        if (data?.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await readJsonSafe<{
        users?: AdminUser[];
        plans?: PlanOption[];
        message?: string;
      }>(response);
      if (!response.ok) {
        setError(data?.message ?? `Falha ao carregar usuarios (HTTP ${response.status}).`);
        return;
      }
      setUsers(data?.users ?? []);
      setPlans(data?.plans ?? []);
    } catch {
      setError("Falha de rede ao carregar usuarios.");
    } finally {
      setLoading(false);
    }
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
        user.name.toLowerCase().includes(term) ||
        user.planId.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
    );
  }, [users, search]);

  const planName = useCallback(
    (planId: string) =>
      plans.find((plan) => plan.id === planId)?.name ?? planId ?? "free",
    [plans]
  );

  async function patch(id: string, action: string, value?: string | number | null) {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, value }),
      });
      const data = await readJsonSafe<{ message?: string }>(response);
      if (!response.ok) {
        setError(data?.message ?? "Falha na operacao.");
        return;
      }
      setMessage("operacao aplicada.");
      await load();
    } catch {
      setError("Falha de rede na operacao.");
    }
  }

  async function removeUser(id: string, email: string) {
    const confirmed = window.confirm(
      `Apagar o usuario ${email}?\n\nIsso remove o login, os chats, as mensagens, o uso e as sessoes dele. Nao da para desfazer.`
    );
    if (!confirmed) return;
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await readJsonSafe<{ message?: string }>(response);
      if (!response.ok) {
        setError(data?.message ?? "Falha ao apagar o usuario.");
        return;
      }
      setMessage(`usuario apagado: ${email}`);
      await load();
    } catch {
      setError("Falha de rede ao apagar o usuario.");
    }
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setCreateLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await readJsonSafe<{ message?: string }>(response);
      if (!response.ok) {
        setError(data?.message ?? "Falha ao criar conta.");
        return;
      }
      setMessage(`conta criada: ${createForm.email}`);
      setCreateForm({ email: "", name: "", planId: "free", role: "user" });
      setShowCreate(false);
      await load();
    } catch {
      setError("Falha de rede ao criar conta.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ usuarios ]
          </h1>
          <p className="text-muted text-[12.5px]">
            {loading
              ? "carregando operadores..."
              : `${users.length} operador(es) registrado(s) no banco de dados.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-full max-w-xs"
            placeholder="buscar por e-mail, nome ou plano..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-xs shrink-0"
            onClick={() => load()}
            disabled={loading}
          >
            {loading ? "carregando" : "recarregar"}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-primary shrink-0"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "fechar" : "+ criar conta teste"}
          </button>
        </div>
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}
      {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}

      {showCreate ? (
        <form
          onSubmit={createAccount}
          className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="label">e-mail</label>
            <input
              className="input"
              type="email"
              required
              placeholder="teste@dominio.com"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm({ ...createForm, email: event.target.value })
              }
            />
          </div>
          <div>
            <label className="label">nome</label>
            <input
              className="input"
              placeholder="Operador Teste"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm({ ...createForm, name: event.target.value })
              }
            />
          </div>
          <div>
            <label className="label">plano</label>
            <select
              className="input"
              value={createForm.planId}
              onChange={(event) =>
                setCreateForm({ ...createForm, planId: event.target.value })
              }
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">papel</label>
            <select
              className="input"
              value={createForm.role}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  role: event.target.value as "user" | "admin",
                })
              }
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={createLoading}
              className="btn btn-primary"
            >
              {createLoading ? "criando..." : "criar conta"}
            </button>
          </div>
        </form>
      ) : null}

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
                  <p className="text-neon break-all">{user.email}</p>
                  <p className="text-muted text-[11.5px]">
                    {user.name || "sem nome"} ::{" "}
                    {formatDateTime(user.createdAt)}
                  </p>
                  {user.lastLoginAt ? (
                    <p className="text-muted text-[11px]">
                      ultimo acesso: {formatDateTime(user.lastLoginAt)}
                    </p>
                  ) : null}
                </td>
                <td>
                  <button
                    type="button"
                    className={`badge ${
                      user.role === "admin" ? "badge-amber" : "badge-muted"
                    }`}
                    onClick={() =>
                      patch(
                        user.id,
                        "set_role",
                        user.role === "admin" ? "user" : "admin"
                      )
                    }
                  >
                    {user.role}
                  </button>
                </td>
                <td>
                  <select
                    className="input w-auto py-1 text-[12px]"
                    value={user.planId}
                    onChange={(event) =>
                      patch(user.id, "set_plan", event.target.value)
                    }
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted mt-1 text-[11px]">
                    {planName(user.planId)}
                  </p>
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
                    <button
                      type="button"
                      className="btn btn-xs btn-danger"
                      disabled={user.id === currentUserId}
                      title={
                        user.id === currentUserId
                          ? "Voce nao pode apagar a propria conta"
                          : "Apagar o usuario e todos os dados dele"
                      }
                      onClick={() => removeUser(user.id, user.email)}
                    >
                      apagar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && !loading ? (
              <tr>
                <td colSpan={8} className="text-muted">
                  {users.length
                    ? "nenhum usuario corresponde a busca"
                    : "nenhum usuario registrado"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
