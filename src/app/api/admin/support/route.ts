import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler, readJson } from "@/lib/errors";
import { listPayments, listUpgradeRequests } from "@/lib/payments";
import { sendSupportPlanMail } from "@/lib/mail";
import type { SupportPlanRecord } from "@/lib/mail";
import { getAppHost, getSetting, setSetting } from "@/lib/settings";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RawRecord = {
  id: string;
  user_email: string;
  plan_name?: string;
  requested_plan_name?: string;
  current_plan_id?: string;
  amount?: number | null;
  status: string;
  pix_key?: string | null;
  activation_code?: string | null;
  created_at: string;
  paid_at?: string | null;
};

function toRecord(row: RawRecord, kind: "pagamento" | "upgrade"): SupportPlanRecord {
  return {
    kind,
    id: row.id,
    userEmail: row.user_email,
    planName:
      (kind === "upgrade" ? (row.requested_plan_name ?? row.plan_name) : row.plan_name) ?? "-",
    currentPlanName: kind === "upgrade" ? row.current_plan_id ?? null : null,
    amount: row.amount ?? null,
    status: row.status,
    pixKey: row.pix_key ?? null,
    activationCode: row.activation_code ?? null,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? null,
  };
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  const [payments, upgrades, supportTo] = await Promise.all([
    listPayments(),
    listUpgradeRequests(),
    getSetting("support:to"),
  ]);

  return NextResponse.json({
    ok: true,
    payments: payments.slice(0, 200),
    upgrades: upgrades.slice(0, 200),
    to: supportTo || process.env.SUPPORT_EMAIL || "",
  });
});

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  const parsed = await readJson(request);
  const body = (parsed.data ?? {}) as { to?: unknown; selection?: unknown; message?: unknown };
  const to = String(body.to ?? "").trim();
  const selection = String(body.selection ?? "").trim();
  const message = String(body.message ?? "").trim().slice(0, 4000);

  if (!EMAIL_RE.test(to)) {
    return NextResponse.json(
      { error: "invalid_email", message: "Informe um e-mail de suporte valido." },
      { status: 400 }
    );
  }
  if (!selection) {
    return NextResponse.json(
      { error: "missing_selection", message: "Selecione o(s) plano(s) comprado(s)." },
      { status: 400 }
    );
  }

  const [payments, upgrades] = await Promise.all([listPayments(), listUpgradeRequests()]);

  let records: SupportPlanRecord[] = [];
  if (selection === "all") {
    records = [
      ...payments.slice(0, 50).map((p) => toRecord(p, "pagamento")),
      ...upgrades.slice(0, 50).map((u) => toRecord(u, "upgrade")),
    ];
  } else if (selection.startsWith("pay:")) {
    const p = payments.find((x) => x.id === selection.slice(4));
    if (!p) {
      return NextResponse.json({ error: "not_found", message: "Pagamento nao encontrado." }, { status: 404 });
    }
    records = [toRecord(p, "pagamento")];
  } else if (selection.startsWith("upg:")) {
    const u = upgrades.find((x) => x.id === selection.slice(4));
    if (!u) {
      return NextResponse.json({ error: "not_found", message: "Solicitacao de upgrade nao encontrada." }, { status: 404 });
    }
    records = [toRecord(u, "upgrade")];
  } else {
    return NextResponse.json({ error: "invalid_selection", message: "Selecao invalida." }, { status: 400 });
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "empty", message: "Nenhum plano comprado encontrado." }, { status: 400 });
  }

  await setSetting("support:to", to);

  const appHost = (await getAppHost()) || "hackerai-nexus.vercel.app";
  await sendSupportPlanMail({ to, message, adminEmail: admin.email, records, appHost });

  await logAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "support.send",
    targetType: "support",
    targetId: selection,
    details: { to, count: records.length, message: message.slice(0, 200) },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, sent: records.length, to });
});
