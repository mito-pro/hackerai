import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler, readJson } from "@/lib/errors";
import { getPlan, listPlans, upsertPlan, type Plan } from "@/lib/plans";
import { setSetting } from "@/lib/settings";
import { pentestEnabled } from "@/lib/scan-config";
import { listScanHistory } from "@/lib/scan-history";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const [plans, scans] = await Promise.all([listPlans(), listScanHistory(null, 50)]);
  return NextResponse.json({
    ok: true,
    enabled: await pentestEnabled(),
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      capabilities: plan.capabilities,
    })),
    scans,
  });
});

const putSchema = z.object({
  enabled: z.boolean().optional(),
  planAccess: z.record(z.string().min(1), z.boolean()).optional(),
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  const raw = await readJson(request);
  const parsed = putSchema.safeParse(raw.data ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const { enabled, planAccess } = parsed.data;
  const changes: Record<string, unknown> = {};

  if (enabled !== undefined) {
    const previous = await pentestEnabled();
    await setSetting("scan:enabled", enabled ? "true" : "false");
    changes.global = { previous, enabled };
  }

  if (planAccess) {
    for (const [planId, allow] of Object.entries(planAccess)) {
      const plan: Plan | null = await getPlan(planId);
      if (!plan) continue;
      const has = plan.capabilities.includes("pentest");
      if (has === allow) continue;
      const capabilities: Plan["capabilities"] = allow
        ? [...plan.capabilities, "pentest"]
        : plan.capabilities.filter((item) => item !== "pentest");
      await upsertPlan({ ...plan, capabilities });
      changes[planId] = { pentest: allow };
    }
  }

  if (Object.keys(changes).length > 0) {
    await logAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "settings.update",
      targetType: "settings",
      targetId: "pentest_access",
      details: changes,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    }).catch(() => undefined);
  }

  const plans = await listPlans();
  return NextResponse.json({
    ok: true,
    enabled: await pentestEnabled(),
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      capabilities: plan.capabilities,
    })),
  });
});
