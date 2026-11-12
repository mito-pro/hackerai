import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { planForUser, rateLimitFor, syncCounters } from "@/lib/usage";
import { getProviderKeys } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

type AudioBody = {
  model?: string;
  text: string;
  voice?: string;
};

export const POST = apiHandler(async (request: Request) => {
  let body: AudioBody;
  try {
    body = (await request.json()) as AudioBody;
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
  const rate = checkRateLimit(`audio:${fresh.id}`, rateLimitFor(plan));
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

  const modelId = body.model ?? "nvidia/riva-translate-4b-instruct-v2";

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
          input: body.text,
          voice: body.voice,
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
    const audioData =
      payload?.data?.[0]?.b64_json ??
      payload?.data?.[0]?.url ??
      payload?.b64_json ??
      "";

    if (!audioData) {
      return NextResponse.json(
        { error: "generation_failed", message: "NVIDIA nao retornou audio." },
        { status: 500 }
      );
    }

    const isBase64 = !audioData.startsWith("http");
    const base64 = isBase64 ? audioData : "";
    const mime = isBase64 ? "audio/mpeg" : "audio/mpeg";
    const dataUri = isBase64 ? `data:${mime};base64,${base64}` : audioData;

    return NextResponse.json({
      ok: true,
      audio: dataUri,
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
