import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler, badRequest, readJson } from "@/lib/errors";
import { run } from "@/lib/db";
import { getPlan, listPlans, upsertPlan, type Plan } from "@/lib/plans";
import { PLAN_CAPABILITY_KEYS, type PlanCapability } from "@/lib/capabilities";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import {
  PROVIDER_IDS,
  PROVIDER_LABELS,
  normalizeProviders,
  type ProviderId,
} from "@/lib/model-registry";
import { resolvePlanModels } from "@/lib/plan-models";
import { providerAvailability } from "@/lib/providers";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const plans = await listPlans();
  const availability = await providerAvailability();

  const planModels: Record<
    string,
    {
      providers: {
        id: string;
        label: string;
        configured: boolean;
        modelCount: number;
      }[];
      models: { id: string; label: string; provider: string; type: string }[];
      missingProviders: string[];
      modelCount: number;
    }
  > = {};

  for (const plan of plans) {
    const bundle = await resolvePlanModels(plan);
    const countByProvider = new Map<ProviderId, number>();
    for (const model of bundle.models) {
      countByProvider.set(
        model.provider,
        (countByProvider.get(model.provider) ?? 0) + 1
      );
    }

    planModels[plan.id] = {
      providers: bundle.providers.map((provider) => ({
        id: provider,
        label: PROVIDER_LABELS[provider] ?? provider,
        configured: availability[provider],
        modelCount: countByProvider.get(provider) ?? 0,
      })),
      models: bundle.models.map((model) => ({
        id: model.id,
        label: model.label,
        provider: model.provider,
        type: model.type,
      })),
      missingProviders: bundle.missingProviders,
      modelCount: bundle.models.length,
    };
  }

  return NextResponse.json({
    plans,
    planModels,
    availability,
    providerLabels: PROVIDER_LABELS,
    providerIds: PROVIDER_IDS,
  });
});

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(40),
  category: z.string().max(40).default(""),
  description: z.string().max(600).default(""),
  price: z.preprocess((val) => (val === "" || val === undefined ? 0 : Number(val)), z.number().min(0)),
  monthlyTokens: z.preprocess((val) => (val === "" || val === undefined ? 0 : Number(val)), z.number().int().min(0)),
  dailyMessages: z.preprocess((val) => (val === "" || val === undefined ? 0 : Number(val)), z.number().int().min(0)),
  maxContext: z.preprocess((val) => (val === "" || val === undefined ? 8000 : Number(val)), z.number().int().min(100)),
  features: z.array(z.string().max(160)).max(60).default([]),
  historyDays: z.preprocess((val) => (val === "" || val === undefined ? 7 : Number(val)), z.number().int().min(0).max(365).default(7)),
  capabilities: z
    .array(
      z.enum(PLAN_CAPABILITY_KEYS as [PlanCapability, ...PlanCapability[]])
    )
    .max(PLAN_CAPABILITY_KEYS.length)
    .default([]),
  providers: z
    .array(z.string())
    .max(PROVIDER_IDS.length)
    .default([]),
  priority: z.preprocess((val) => (val === "" || val === undefined ? 10 : Number(val)), z.number().int().min(0).max(999).default(10)),
  isDefault: z.boolean().default(false),
});

export const PUT = apiHandler(async (request: Request) => {
  await requireAdmin();
  const raw = await readJson(request);
  if (!raw.ok) return badRequest("Dados do plano invalidos.");
  const parsed = planSchema.safeParse(raw.data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
      .join(" · ");
    return NextResponse.json(
      {
        error: "bad_request",
        message: `Dados do plano invalidos (${issues}).`,
        issues,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const id = slugify(data.id || data.name) || `plan-${Date.now()}`;
  const plan: Plan = {
    ...data,
    id,
    providers: normalizeProviders(data.providers),
  };

  await upsertPlan(plan);

  if (plan.isDefault) {
    for (const other of await listPlans()) {
      if (other.id !== id && other.isDefault) {
        await upsertPlan({ ...other, isDefault: false });
      }
    }
  }

  return NextResponse.json({ ok: true, plan: await getPlan(id) });
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
