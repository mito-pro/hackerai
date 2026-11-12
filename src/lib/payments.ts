import { all, get, nowIso, run } from "./db";
import { generateOtpCode } from "./crypto";
import { generateId } from "./utils";
import { getOtpMailSettings, getAppHost } from "./settings";
import nodemailer from "nodemailer";
import { getPlan } from "./plans";

export type Payment = {
  id: string;
  user_id: string;
  user_email: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  pix_key: string;
  pix_qr_code: string | null;
  status: "pending" | "paid" | "expired";
  activation_code: string | null;
  code_sent: number;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
};

export type UpgradeRequest = {
  id: string;
  user_id: string;
  user_email: string;
  current_plan_id: string;
  requested_plan_id: string;
  requested_plan_name: string;
  status: "pending" | "approved" | "rejected";
  activation_code: string | null;
  pix_key: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

const PIX_EXPIRY_MINUTES = 60;
const ACTIVATION_CODE_TTL_MINUTES = 30;

async function createPixTransporter() {
  const settings = await getOtpMailSettings();
  if (!settings) throw new Error("SMTP nao configurado.");
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

export async function listPayments(): Promise<Payment[]> {
  const rows = await all<Payment & { status: string }>(
    "SELECT * FROM payments ORDER BY created_at DESC"
  );
  return rows.map((row) => ({ ...row, status: row.status as Payment["status"] }));
}

export async function getPayment(id: string): Promise<Payment | null> {
  const row = await get<Payment & { status: string }>(
    "SELECT * FROM payments WHERE id = ?",
    [id]
  );
  if (!row) return null;
  return { ...row, status: row.status as Payment["status"] };
}

export async function createPayment(
  userId: string,
  userEmail: string,
  planId: string,
  pixKey: string
): Promise<Payment> {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plano nao encontrado.");

  const id = generateId("pay");
  const now = nowIso();
  const expiresAt = new Date(Date.now() + PIX_EXPIRY_MINUTES * 60_000).toISOString();
  const activationCode = generateOtpCode();

  await run(
    `INSERT INTO payments
      (id, user_id, user_email, plan_id, plan_name, amount, pix_key, pix_qr_code, status, activation_code, code_sent, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)`,
    [id, userId, userEmail, planId, plan.name, plan.price, pixKey, null, activationCode, now, expiresAt]
  );

  return {
    id,
    user_id: userId,
    user_email: userEmail,
    plan_id: planId,
    plan_name: plan.name,
    amount: plan.price,
    pix_key: pixKey,
    pix_qr_code: null,
    status: "pending",
    activation_code: activationCode,
    code_sent: 0,
    created_at: now,
    paid_at: null,
    expires_at: expiresAt,
  };
}

export async function sendActivationCode(paymentId: string): Promise<boolean> {
  const payment = await getPayment(paymentId);
  if (!payment || payment.status !== "pending") return false;

  const appHost = await getAppHost();
  const code = payment.activation_code ?? generateOtpCode();

  try {
    const transporter = await createPixTransporter();
    const subject = `[HACKER_AI NEXUS] Codigo de ativacao :: ${payment.plan_name}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eaeaea;padding:24px;border-radius:12px;border:1px solid #222;">
        <h2 style="color:#00ff88;margin:0 0 16px;">Codigo de ativacao de plano</h2>
        <p>Olá, seu pagamento para o plano <strong>${payment.plan_name}</strong> (R$ ${payment.amount.toFixed(2)}) foi confirmado.</p>
        <p style="font-size:32px;letter-spacing:8px;color:#00ff88;font-weight:bold;margin:24px 0;">${code}</p>
        <p style="font-size:13px;color:#888;">Este codigo expira em ${ACTIVATION_CODE_TTL_MINUTES} minutos.</p>
        <p style="font-size:13px;color:#888;">Acesse: ${appHost || "seu-dominio"}/ativar-plano</p>
      </div>
    `;
    await transporter.sendMail({
      from: (await getOtpMailSettings())!.from,
      to: payment.user_email,
      subject,
      html,
      text: `Codigo de ativacao para ${payment.plan_name}: ${code}. Expira em ${ACTIVATION_CODE_TTL_MINUTES} minutos.`,
    });
  } catch {
    return false;
  }

  await run(
    "UPDATE payments SET code_sent = 1 WHERE id = ?",
    [paymentId]
  );
  return true;
}

export async function confirmPayment(paymentId: string): Promise<Payment> {
  const payment = await getPayment(paymentId);
  if (!payment) throw new Error("Pagamento nao encontrado.");
  if (payment.status === "paid") return payment;

  await run(
    `UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?`,
    [nowIso(), paymentId]
  );
  return { ...payment, status: "paid", paid_at: nowIso() };
}

export async function expirePayment(paymentId: string): Promise<void> {
  await run("UPDATE payments SET status = 'expired' WHERE id = ?", [paymentId]);
}

export async function listUpgradeRequests(): Promise<UpgradeRequest[]> {
  const rows = await all<UpgradeRequest & { status: string }>(
    "SELECT * FROM upgrade_requests ORDER BY created_at DESC"
  );
  return rows.map((row) => ({ ...row, status: row.status as UpgradeRequest["status"] }));
}

export async function createUpgradeRequest(
  userId: string,
  userEmail: string,
  currentPlanId: string,
  currentPlanName: string,
  requestedPlanId: string,
  requestedPlanName: string,
  pixKey: string
): Promise<UpgradeRequest> {
  const id = generateId("upg");
  const now = nowIso();
  const activationCode = generateOtpCode();

  await run(
    `INSERT INTO upgrade_requests
      (id, user_id, user_email, current_plan_id, requested_plan_id, requested_plan_name, status, activation_code, pix_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [id, userId, userEmail, currentPlanId, requestedPlanId, requestedPlanName, activationCode, pixKey, now]
  );

  return {
    id,
    user_id: userId,
    user_email: userEmail,
    current_plan_id: currentPlanId,
    requested_plan_id: requestedPlanId,
    requested_plan_name: requestedPlanName,
    status: "pending",
    activation_code: activationCode,
    pix_key: pixKey,
    admin_notes: null,
    resolved_at: null,
    resolved_by: null,
    created_at: now,
  };
}

export async function resolveUpgradeRequest(
  requestId: string,
  status: "approved" | "rejected",
  adminNotes: string | null,
  resolvedBy: string,
  pixKey?: string
): Promise<UpgradeRequest> {
  const row = await get<UpgradeRequest & { status: string }>(
    "SELECT * FROM upgrade_requests WHERE id = ?",
    [requestId]
  );
  if (!row) throw new Error("Solicitacao nao encontrada.");
  if (row.status !== "pending") throw new Error("Solicitacao ja foi processada.");

  const now = nowIso();
  const activationCode = status === "approved" ? generateOtpCode() : null;
  const finalPixKey = pixKey ?? row.pix_key ?? null;

  await run(
    `UPDATE upgrade_requests
      SET status = ?, activation_code = ?, pix_key = ?, admin_notes = ?, resolved_at = ?, resolved_by = ?
     WHERE id = ?`,
    [status, activationCode, finalPixKey, adminNotes, now, resolvedBy, requestId]
  );

  return {
    ...row,
    status,
    activation_code: activationCode,
    pix_key: finalPixKey,
    admin_notes: adminNotes,
    resolved_at: now,
    resolved_by: resolvedBy,
  } as UpgradeRequest;
}

export async function sendUpgradeActivationEmail(requestId: string): Promise<boolean> {
  const row = await get<UpgradeRequest & { status: string }>(
    "SELECT * FROM upgrade_requests WHERE id = ?",
    [requestId]
  );
  if (!row || row.status !== "approved") return false;

  const appHost = await getAppHost();
  const code = row.activation_code ?? generateOtpCode();

  try {
    const transporter = await createPixTransporter();
    const subject = `[HACKER_AI NEXUS] Upgrade aprovado :: ${row.requested_plan_name}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eaeaea;padding:24px;border-radius:12px;border:1px solid #222;">
        <h2 style="color:#00ff88;margin:0 0 16px;">Upgrade aprovado</h2>
        <p>Olá, sua solicitacao de upgrade para o plano <strong>${row.requested_plan_name}</strong> foi aprovada pelo administrador.</p>
        <p style="font-size:32px;letter-spacing:8px;color:#00ff88;font-weight:bold;margin:24px 0;">${code}</p>
        ${row.pix_key ? `<p style="font-size:13px;color:#888;">Chave PIX para pagamento: <strong>${row.pix_key}</strong></p>` : null}
        <p style="font-size:13px;color:#888;">Este codigo expira em ${ACTIVATION_CODE_TTL_MINUTES} minutos.</p>
        <p style="font-size:13px;color:#888;">Acesse: ${appHost || "seu-dominio"}/ativar-plano</p>
      </div>
    `;
    await transporter.sendMail({
      from: (await getOtpMailSettings())!.from,
      to: row.user_email,
      subject,
      html,
      text: `Upgrade aprovado para ${row.requested_plan_name}. Codigo: ${code}. Chave PIX: ${row.pix_key ?? "nao informada"}.`,
    });
  } catch {
    return false;
  }

  return true;
}
