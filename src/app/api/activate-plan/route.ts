import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { get, run } from "@/lib/db";
import { getPlan, upsertPlan } from "@/lib/plans";

export const runtime = "nodejs";

type ActivateBody = {
  code: string;
};

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const raw = await request.json();
  const code = String(raw?.code ?? "").trim();
  if (!code) {
    return NextResponse.json(
      { error: "bad_request", message: "Informe o codigo de ativacao." },
      { status: 400 }
    );
  }

  // Procura o pagamento pendente/paid deste usuario com este codigo
  const payment = await get<{
    id: string;
    user_id: string;
    plan_id: string;
    plan_name: string;
    activation_code: string | null;
    status: string;
    paid_at: string | null;
  }>(
    `SELECT * FROM payments WHERE user_id = ? AND activation_code = ? ORDER BY created_at DESC LIMIT 1`,
    [user.id, code]
  );

  if (!payment) {
    // Procura tambem em upgrade_requests aprovados
    const upgrade = await get<{
      id: string;
      user_id: string;
      requested_plan_id: string;
      requested_plan_name: string;
      activation_code: string | null;
      status: string;
    }>(
      `SELECT * FROM upgrade_requests WHERE user_id = ? AND activation_code = ? ORDER BY created_at DESC LIMIT 1`,
      [user.id, code]
    );

    if (!upgrade || upgrade.status !== "approved") {
      return NextResponse.json(
        { error: "not_found", message: "Codigo de ativacao invalido ou nao aprovado." },
        { status: 404 }
      );
    }

    const plan = await getPlan(upgrade.requested_plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: "not_found", message: "Plano nao encontrado." },
        { status: 404 }
      );
    }

    await run(
      `UPDATE users SET plan_id = ? WHERE id = ?`,
      [upgrade.requested_plan_id, user.id]
    );

    await run(
      `UPDATE upgrade_requests SET status = 'completed' WHERE id = ?`,
      [upgrade.id]
    );

    return NextResponse.json({
      ok: true,
      plan: upgrade.requested_plan_id,
      planName: plan.name,
      message: `Plano ${plan.name} ativado com sucesso.`,
    });
  }

  if (payment.status !== "paid") {
    return NextResponse.json(
      { error: "bad_request", message: "Pagamento nao foi confirmado." },
      { status: 400 }
    );
  }

  const plan = await getPlan(payment.plan_id);
  if (!plan) {
    return NextResponse.json(
      { error: "not_found", message: "Plano nao encontrado." },
      { status: 404 }
    );
  }

  await run(
    `UPDATE users SET plan_id = ? WHERE id = ?`,
    [payment.plan_id, user.id]
  );

  await run(
    `UPDATE payments SET status = 'completed' WHERE id = ?`,
    [payment.id]
  );

  return NextResponse.json({
    ok: true,
    plan: payment.plan_id,
    planName: plan.name,
    message: `Plano ${plan.name} ativado com sucesso.`,
  });
});
