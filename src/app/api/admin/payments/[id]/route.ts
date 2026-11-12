import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { getPayment, confirmPayment, sendActivationCode } from "@/lib/payments";
import { sendPaymentConfirmationMail } from "@/lib/mail";
import { getAppHost } from "@/lib/settings";

export const runtime = "nodejs";

export const PATCH = apiHandler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) {
    return NextResponse.json({ error: "not_found", message: "Pagamento nao encontrado." }, { status: 404 });
  }

  const updated = await confirmPayment(id);

  // Enviar email com codigo de ativacao
  const sent = await sendActivationCode(updated.id);
  if (sent) {
    await sendPaymentConfirmationMail({
      email: updated.user_email,
      name: updated.user_email.split("@")[0],
      planName: updated.plan_name,
      amount: updated.amount,
      pixKey: updated.pix_key,
      activationCode: updated.activation_code ?? "",
      appHost: await getAppHost() || "hackerai-nexus.vercel.app",
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, payment: updated, codeSent: sent });
});
