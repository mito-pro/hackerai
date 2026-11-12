import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { getPayment, sendActivationCode, confirmPayment, expirePayment } from "@/lib/payments";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) {
    return NextResponse.json({ error: "not_found", message: "Pagamento nao encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, payment });
});

export const POST = apiHandler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) {
    return NextResponse.json({ error: "not_found", message: "Pagamento nao encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "confirm") {
    const updated = await confirmPayment(id);
    await sendActivationCode(updated.id);
    return NextResponse.json({ ok: true, payment: updated, activationCode: updated.activation_code });
  }

  if (action === "send-code") {
    const sent = await sendActivationCode(id);
    return NextResponse.json({ ok: true, codeSent: sent });
  }

  if (action === "expire") {
    await expirePayment(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_request", message: "Acao invalida." }, { status: 400 });
});
