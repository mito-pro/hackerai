import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { providerAvailability } from "@/lib/providers";
import { MODELS } from "@/lib/model-registry";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request) => {
  await requireUser();
  const availability = await providerAvailability();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "text" | "image" | "audio" | "video" | null;

  const models = MODELS.filter((m) => {
    if (m.provider !== "local" && !availability[m.provider]) return false;
    if (type && m.type !== type) return false;
    return true;
  });

  return NextResponse.json({
    ok: true,
    models: models.map((m) => ({
      id: m.id,
      label: m.label,
      provider: m.provider,
      type: m.type,
    })),
  });
});
