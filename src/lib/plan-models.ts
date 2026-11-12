import type { Plan } from "./plans";
import {
  listCompatibleModelsByProvider,
  providerAvailability,
} from "./providers";
import {
  PROVIDER_LABELS,
  listModels,
  providersForPlan,
  type ModelDef,
  type ProviderId,
} from "./model-registry";

export type PlanModelBundle = {
  providers: ProviderId[];
  models: ModelDef[];
  availability: Record<ProviderId, boolean>;
  missingProviders: ProviderId[];
  externalProviders: ProviderId[];
  hasExternalModels: boolean;
};

export async function resolvePlanModels(
  plan: Pick<Plan, "id" | "providers" | "capabilities">,
  isAdmin = false
): Promise<PlanModelBundle> {
  const availability = await providerAvailability();
  const providers = providersForPlan(plan, isAdmin);

  const base = listModels({
    hasGroq: availability.groq,
    hasGoogle: availability.google,
    hasOpenRouter: availability.openrouter,
    hasOllama: availability.ollama,
    hasNvidia: availability.nvidia,
    hasOpenCode: availability.opencode,
    hasVercel: availability.vercel,
    capabilities: plan.capabilities,
    providers,
  });

  const dynamic = (await listCompatibleModelsByProvider()).filter((model) =>
    providers.includes(model.provider)
  );

  const models = [...base, ...dynamic];
  const externalProviders = providers.filter((provider) => provider !== "local");
  const missingProviders = externalProviders.filter(
    (provider) => !availability[provider]
  );

  return {
    providers,
    models,
    availability,
    missingProviders,
    externalProviders,
    hasExternalModels: models.some((model) => model.provider !== "local"),
  };
}

export function missingProviderLabels(providers: ProviderId[]) {
  return providers.map((provider) => ({
    id: provider,
    label: PROVIDER_LABELS[provider] ?? provider,
  }));
}
