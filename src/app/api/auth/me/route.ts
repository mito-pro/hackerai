import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPlan, hasCapability } from "@/lib/plans";
import { syncCounters, usageSummary } from "@/lib/usage";
import { providerAvailability } from "@/lib/providers";
import { listModels } from "@/lib/model-registry";
import { listOmegaModels } from "@/lib/omega";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const fresh = syncCounters(user.id);
  if (!fresh) return NextResponse.json({ user: null }, { status: 200 });

  const plan = getPlan(fresh.plan_id) ?? getPlan("free")!;
  const availability = providerAvailability();
  const models = listModels({
    hasGroq: availability.groq,
    hasGoogle: availability.google,
    hasOpenRouter: availability.openrouter,
    hasOllama: availability.ollama,
    capabilities: plan.capabilities,
  });

  if (hasCapability(plan, "uncensored") && availability.ollama) {
    models.push(...(await listOmegaModels()));
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
    },
    usage: usageSummary(fresh, plan),
    models,
  });
}
