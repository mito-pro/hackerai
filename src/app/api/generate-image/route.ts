import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { planForUser, rateLimitFor, syncCounters } from "@/lib/usage";
import { getProviderKeys } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

type ImageBody = {
  model?: string;
  prompt: string;
  width?: number;
  height?: number;
};

export const POST = apiHandler(async (request: Request) => {
  let body: ImageBody;
  try {
    body = (await request.json()) as ImageBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const user = await requireUser();
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;
  const fresh = await syncCounters(user.id);
  if (!fresh) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sessao expirada." },
      { status: 401 }
    );
  }

  const plan = await planForUser(fresh);
  const rate = checkRateLimit(`image:${fresh.id}`, rateLimitFor(plan));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit",
        message: `Fila cheia: limite de ${rate.limit} requisicoes por minuto.`,
      },
      { status: 429 }
    );
  }

  const keys = await getProviderKeys();
  if (!keys.nvidia) {
    return NextResponse.json(
      { error: "provider_missing", message: "NVIDIA API key nao configurada." },
      { status: 400 }
    );
  }

  const modelId = body.model ?? "nvidia/nemotron-3.5-super-vl-120b-a12b";

  try {
    const response = await fetch(
      "https://integrate.api.nvidia.com/v1/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keys.nvidia}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          prompt: body.prompt,
          width: body.width ?? 1024,
          height: body.height ?? 1024,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "generation_failed", message: `NVIDIA HTTP ${response.status}: ${errorText}` },
        { status: 500 }
      );
    }

    const payload = await response.json();
    const imageData =
      payload?.data?.[0]?.b64_json ??
      payload?.data?.[0]?.url ??
      payload?.b64_json ??
      "";

    if (!imageData) {
      return NextResponse.json(
        { error: "generation_failed", message: "NVIDIA nao retornou imagem." },
        { status: 500 }
      );
    }

    const isBase64 = !imageData.startsWith("http");
    const base64 = isBase64 ? imageData : "";
    const mime = isBase64 ? "image/png" : "image/png";
    const dataUri = isBase64 ? `data:${mime};base64,${base64}` : imageData;

    return NextResponse.json({
      ok: true,
      image: dataUri,
      mime,
      model: modelId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "generation_failed", message },
      { status: 500 }
    );
  }
});
