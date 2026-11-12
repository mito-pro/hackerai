import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { planForUser, rateLimitFor, syncCounters } from "@/lib/usage";
import { getProviderKeys } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

type VideoBody = {
  model?: string;
  prompt: string;
  duration?: number;
  aspect_ratio?: string;
  image_url?: string;
  enable_sound?: boolean;
};

const RUNPI_BASE = "https://runapi.ai/api/v1";

async function pollRunpiTask(
  apiKey: string,
  taskUrl: string,
  maxWaitMs = 240_000
): Promise<string> {
  const started = Date.now();
  const interval = 5000;
  while (Date.now() - started < maxWaitMs) {
    const response = await fetch(taskUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`RunAPI poll HTTP ${response.status}`);
    }
    const payload = await response.json();
    const status = payload?.status || payload?.task_status || "";
    if (status === "completed" || status === "succeeded" || status === "done") {
      const videoUrl =
        payload?.video_url ??
        payload?.result?.video_url ??
        payload?.data?.video_url ??
        payload?.url ??
        "";
      if (videoUrl) return videoUrl;
    }
    if (status === "failed" || status === "error" || status === "cancelled") {
      throw new Error(`RunAPI task ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("RunAPI task timeout");
}

export const POST = apiHandler(async (request: Request) => {
  let body: VideoBody;
  try {
    body = (await request.json()) as VideoBody;
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
  const rate = checkRateLimit(`video:${fresh.id}`, rateLimitFor(plan));
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
  if (!keys.runapi) {
    return NextResponse.json(
      { error: "provider_missing", message: "RunAPI chave nao configurada." },
      { status: 400 }
    );
  }

  const modelId = body.model ?? "kling-v2.1-standard";
  const taskType = body.image_url ? "image_to_video" : "text_to_video";

  try {
    const startResponse = await fetch(
      `${RUNPI_BASE}/${modelId}/${taskType}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keys.runapi}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt: body.prompt,
          duration: body.duration ?? 5,
          aspect_ratio: body.aspect_ratio ?? "16:9",
          ...(body.image_url ? { image_url: body.image_url } : {}),
          ...(body.enable_sound !== undefined ? { enable_sound: body.enable_sound } : {}),
        }),
      }
    );

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      return NextResponse.json(
        {
          error: "generation_failed",
          message: `RunAPI HTTP ${startResponse.status}: ${errorText}`,
        },
        { status: 500 }
      );
    }

    const startPayload = await startResponse.json();
    const taskUrl =
      startPayload?.task_url ??
      startPayload?.url ??
      `${RUNPI_BASE}/tasks/${startPayload?.task_id ?? ""}`;

    const videoUrl = await pollRunpiTask(keys.runapi, taskUrl);

    return NextResponse.json({
      ok: true,
      video: videoUrl,
      mime: "video/mp4",
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
