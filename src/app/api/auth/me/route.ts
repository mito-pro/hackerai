import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPlan, hasCapability } from "@/lib/plans";
import { syncCounters, usageSummary } from "@/lib/usage";
import { listOmegaModels } from "@/lib/omega";
import { getMaintenance } from "@/lib/settings";
import {
  resolvePlanModels,
  missingProviderLabels,
} from "@/lib/plan-models";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const fresh = await syncCounters(user.id);
  if (!fresh) return NextResponse.json({ user: null }, { status: 200 });

  const plan = (await getPlan(fresh.plan_id)) ?? (await getPlan("free"))!;
  const isAdmin = fresh.role === "admin";
  const maintenance = await getMaintenance();

  const bundle = await resolvePlanModels(plan, isAdmin);

  let models = bundle.models;

  if (hasCapability(plan, "uncensored")) {
    const staticOmega = models.filter((model) => model.uncensored);
    const dynamicOmega = (await listOmegaModels()).filter(
      (model) => !staticOmega.some((item) => item.id === model.id)
    );
    models = [...models, ...dynamicOmega];
  }

  return NextResponse.json({
    user: {
      id: fresh.id,
      email: fresh.email,
      name: fresh.name,
      role: fresh.role,
      planId: fresh.plan_id,
      planName: plan.name,
      capabilities: plan.capabilities,
      maxContext: plan.maxContext,
      providers: bundle.providers,
    },
    usage: usageSummary(fresh, plan),
    models,
    missingProviders: missingProviderLabels(bundle.missingProviders),
    fallbackActive: !bundle.hasExternalModels,
    maintenance: {
      enabled: maintenance.enabled && !isAdmin,
      message: maintenance.message,
    },
  });
}
