import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { createUpgradeRequest, type UpgradeRequest } from "@/lib/payments";
import { getPlan } from "@/lib/plans";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  requestedPlanId: z.string().min(1),
  pixKey: z.string().min(1).max(120),
});

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "Dados invalidos." }, { status: 400 });
  }

  const currentPlan = await getPlan(user.planId);
  const requestedPlan = await getPlan(parsed.data.requestedPlanId);
  if (!currentPlan || !requestedPlan) {
    return NextResponse.json({ error: "bad_request", message: "Plano invalido." }, { status: 400 });
  }

  if (requestedPlan.priority <= currentPlan.priority) {
    return NextResponse.json(
      { error: "bad_request", message: "Escolha um plano superior ao seu." },
      { status: 400 }
    );
  }

  const upgradeRequest = await createUpgradeRequest(
    user.id,
    user.email,
    currentPlan.id,
    currentPlan.name,
    requestedPlan.id,
    requestedPlan.name,
    parsed.data.pixKey
  );
  return NextResponse.json({ ok: true, request: upgradeRequest });
});
