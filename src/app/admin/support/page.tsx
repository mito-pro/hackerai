"use client";

import { useCallback, useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type PaymentRow = {
  id: string;
  user_email: string;
  plan_name: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};

type UpgradeRow = {
  id: string;
  user_email: string;
  current_plan_id: string;
  requested_plan_name: string;
  status: string;
  created_at: string;
};

type SupportData = {
  payments: PaymentRow[];
  upgrades: UpgradeRow[];
  to: string;
};

const STATUS_LABEL: Record<string, string> = {
  paid: "pago",
  pending: "pendente",
  expired: "expirado",
  approved: "aprovado",
  rejected: "rejeitado",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminSupportPage() {
  const [data, setData] = useState<SupportData | null>(null);
  const [selection, setSelection] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support", { cache: "no-store" });
      const payload = await readJsonSafe<SupportData & { message?: string }>(response);
      if (!response.ok) {
        setError(payload?.message ?? "Falha ao carregar os planos comprados.");
        return;
      }
      if (!payload || !payload.payments) {
        setError("Resposta invalida do servidor.");
        return;
      }
      setData(payload);
      setTo((current) => current || payload.to || "");
      setSelection((current) => current || (payload.payments[0] ? `pay:${payload.payments[0].id}` : "all"));
    } catch {
      setError("Falha de rede ao carregar os planos comprados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!selection) {
      setError("Selecione o plano comprado que deseja enviar.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, selection, message }),
      });
      const payload = await readJsonSafe<{ sent?: number; to?: string; message?: string }>(response);
      if (!response.ok) {
        setError(payload?.message ?? "Falha ao enviar o e-mail de suporte.");
        return;
      }
      setNotice(`enviado: ${payload?.sent ?? 0} registro(s) para ${payload?.to ?? to}.`);
      setMessage("");
    } catch {
      setError("Falha de rede ao enviar o e-mail de suporte.");
    } finally {
      setSending(false);
    }
  }

  const payments = data?.payments ?? [];
  const upgrades = data?.upgrades ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">[ suporte ]</h1>
        <p className="text-muted text-[12.5px]">
          Envia por e-mail (Gmail/SMTP) os dados de plano(s) comprado(s) para a
          caixa de suporte: usuario, plano, valor, status, chave PIX, codigo de
          ativacao e datas.
        </p>
      </header>

      {notice ? <p className="text-neon text-[12.5px]">{notice}</p> : null}
      {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}

      <section className="panel grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-muted text-[11px] tracking-[0.16em] uppercase">
            pagamentos
          </p>
          <p className="text-neon text-2xl">{payments.length}</p>
        </div>
        <div>
          <p className="text-muted text-[11px] tracking-[0.16em] uppercase">
            upgrades
          </p>
          <p className="text-neon text-2xl">{upgrades.length}</p>
        </div>
        <div>
          <p className="text-muted text-[11px] tracking-[0.16em] uppercase">
            destino
          </p>
          <p className="text-text truncate text-[12.5px]">
            {loading ? "carregando..." : to || "nao configurado"}
          </p>
        </div>
      </section>

      <form onSubmit={send} className="panel space-y-4 p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          enviar dados de plano por e-mail
        </h2>

        <div>
          <label className="label" htmlFor="support-selection">
            plano comprado
          </label>
          <select
            id="support-selection"
            className="input"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
            disabled={loading}
          >
            <option value="all">
              todos os registros recentes ({payments.length + upgrades.length})
            </option>
            {payments.map((payment) => (
              <option key={`pay:${payment.id}`} value={`pay:${payment.id}`}>
                pagamento · {payment.user_email} · {payment.plan_name} · R${" "}
                {payment.amount.toFixed(2)} · {STATUS_LABEL[payment.status] ?? payment.status} ·{" "}
                {fmtDate(payment.created_at)}
              </option>
            ))}
            {upgrades.map((upgrade) => (
              <option key={`upg:${upgrade.id}`} value={`upg:${upgrade.id}`}>
                upgrade · {upgrade.user_email} · {upgrade.requested_plan_name} ·{" "}
                {STATUS_LABEL[upgrade.status] ?? upgrade.status} ·{" "}
                {fmtDate(upgrade.created_at)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="support-to">
            e-mail de destino (gmail)
          </label>
          <input
            id="support-to"
            type="email"
            className="input"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="seu.suporte@gmail.com"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="support-message">
            mensagem (opcional)
          </label>
          <textarea
            id="support-message"
            className="input resize-none"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Contexto do suporte: problema, solicitacao do cliente, etc."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={sending || loading}>
            {sending ? "enviando..." : "enviar para o suporte"}
          </button>
          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? "atualizando..." : "atualizar lista"}
          </button>
        </div>
      </form>

      <section className="panel p-5">
        <h2 className="text-neon text-sm tracking-[0.18em] uppercase">
          como funciona
        </h2>
        <ul className="text-muted mt-3 space-y-1 text-[12.5px]">
          <li>:: o e-mail sai pelo SMTP configurado no sistema (mesmo usado no login/PIX).</li>
          <li>:: o destino informado fica salvo como suporte:to e reaparece na proxima vez.</li>
          <li>:: cada envio fica registrado na auditoria como support.send.</li>
          <li>:: nenhum codigo de ativacao e enviado ao cliente por esta via.</li>
        </ul>
      </section>
    </div>
  );
}
