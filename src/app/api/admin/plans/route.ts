import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler, badRequest, readJson } from "@/lib/errors";
import { run } from "@/lib/db";
import { getPlan, listPlans, upsertPlan, type Plan } from "@/lib/plans";
import { PLAN_CAPABILITY_KEYS, type PlanCapability } from "@/lib/capabilities";
import { z } from "zod";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  return NextResponse.json({ plans: listPlans() });
});

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(40),
  category: z.string().max(40).default(""),
  description: z.string().max(240).default(""),
  price: z.number().min(0),
  monthlyTokens: z.number().int().min(0),
  dailyMessages: z.number().int().min(0),
  maxContext: z.number().int().min(1000),
  features: z.array(z.string().max(80)).max(40).default([]),
  historyDays: z.number().int().min(0).max(365).default(7),
  capabilities: z
    .array(
      z.enum(PLAN_CAPABILITY_KEYS as [PlanCapability, ...PlanCapability[]])
    )
    .max(PLAN_CAPABILITY_KEYS.length)
    .default([]),
  priority: z.number().int().min(0).max(999).default(10),
  isDefault: z.boolean().default(false),
});

export const PUT = apiHandler(async (request: Request) => {
  await requireAdmin();
  const raw = await readJson(request);
  if (!raw.ok) return badRequest("Dados do plano invalidos.");
  const parsed = planSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Dados do plano invalidos." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const id = slugify(data.id || data.name) || `plan-${Date.now()}`;
  const plan: Plan = { ...data, id };

  upsertPlan(plan);

  if (plan.isDefault) {
    for (const other of listPlans()) {
      if (other.id !== id && other.isDefault) {
        upsertPlan({ ...other, isDefault: false });
      }
    }
  }

  return NextResponse.json({ ok: true, plan: getPlan(id) });
});

export const DELETE = apiHandler(async (request: Request) => {
  await requireAdmin();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "bad_request", message: "Informe o id do plano." },
      { status: 400 }
    );
  }
  if (id === "free") {
    return NextResponse.json(
      { error: "forbidden", message: "O plano FREE nao pode ser removido." },
      { status: 400 }
    );
  }
  run("UPDATE users SET plan_id = 'free' WHERE plan_id = ?", [id]);
  run("DELETE FROM plans WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
});
