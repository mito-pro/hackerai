import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { planForUser, rateLimitFor, syncCounters } from "@/lib/usage";
import { getProviderKeys } from "@/lib/settings";
import { findModel } from "@/lib/model-registry";

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

const RUNPI_BASE = "https://runapi.ai/v1";
const POLLINATIONS_VIDEO_BASE = "https://gen.pollinations.ai/video";
const DEFAULT_MODEL = "pollinations/default";
const MAX_VIDEO_BYTES = 3_000_000;

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

async function generateRunapi(options: {
  apiKey: string;
  modelId: string;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  imageUrl?: string;
  enableSound?: boolean;
}): Promise<string> {
  const taskType = options.imageUrl ? "image_to_video" : "text_to_video";
  const startResponse = await fetch(
    `${RUNPI_BASE}/${options.modelId}/${taskType}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: options.prompt,
        duration: options.duration ?? 5,
        aspect_ratio: options.aspectRatio ?? "16:9",
        ...(options.imageUrl ? { image_url: options.imageUrl } : {}),
        ...(options.enableSound !== undefined
          ? { enable_sound: options.enableSound }
          : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!startResponse.ok) {
    const errorText = await startResponse.text();
    throw new Error(`RunAPI HTTP ${startResponse.status}: ${errorText.slice(0, 300)}`);
  }

  const startPayload = await startResponse.json();
  const taskUrl =
    startPayload?.task_url ??
    startPayload?.url ??
    `${RUNPI_BASE}/tasks/${startPayload?.task_id ?? ""}`;

  return pollRunpiTask(options.apiKey, taskUrl);
}

async function generatePollinations(options: {
  prompt: string;
  model: string;
  seed?: number;
}): Promise<string> {
  const params = new URLSearchParams({ referrer: "hackerai-nexus" });
  if (options.model) params.set("model", options.model);
  if (Number.isFinite(options.seed)) params.set("seed", String(options.seed));

  const url = `${POLLINATIONS_VIDEO_BASE}/${encodeURIComponent(options.prompt)}?${params.toString()}`;

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(240_000),
      headers: { Accept: "video/mp4, video/*" },
    });

    const contentType = (response.headers.get("content-type") || "").toLowerCase();

    if (response.ok && contentType.startsWith("video")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.byteLength) throw new Error("Pollinations retornou video vazio.");
      if (buffer.byteLength > MAX_VIDEO_BYTES) {
        throw new Error(
          `Video muito grande (${Math.round(buffer.byteLength / 1e6)}MB). Tente outro modelo.`
        );
      }
      return `data:video/mp4;base64,${buffer.toString("base64")}`;
    }

    const errorText = contentType.includes("json")
      ? await response.text()
      : `HTTP ${response.status}`;
    lastError = errorText.slice(0, 300);

    const limited =
      response.status === 401 ||
      response.status === 402 ||
      response.status === 429;
    if (!limited || attempt === 2) break;

    const waitMatch = errorText.match(/Retry after (\d+)s/i);
    const waitSeconds = waitMatch ? Number(waitMatch[1]) + 2 : 20;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(Math.max(waitSeconds, 10), 70) * 1000)
    );
  }

  throw new Error(`Pollinations: ${lastError || "sem resposta"}`);
}

function providerOf(modelId: string): "pollinations" | "runapi" {
  if (modelId.startsWith("runapi/")) return "runapi";
  return "pollinations";
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

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "bad_request", message: "Prompt vazio." },
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
  const modelId = body.model?.trim() || DEFAULT_MODEL;
  const provider = providerOf(modelId);
  const def = findModel(modelId);
  const runapiModel =
    def && def.provider === "runapi" && def.modelId
      ? def.modelId
      : modelId.replace("runapi/", "");
  const pollinationsModel =
    def && def.provider === "pollinations" ? def.modelId || "" : "";

  const attempts: Array<{ name: string; run: () => Promise<string> }> = [];

  if (provider === "runapi" && keys.runapi) {
    attempts.push({
      name: "runapi",
      run: () =>
        generateRunapi({
          apiKey: keys.runapi,
          modelId: runapiModel,
          prompt,
          duration: body.duration,
          aspectRatio: body.aspect_ratio,
          imageUrl: body.image_url,
          enableSound: body.enable_sound,
        }),
    });
  }

  attempts.push({
    name: "pollinations",
    run: () => generatePollinations({ prompt, model: pollinationsModel }),
  });

  if (provider !== "runapi" && keys.runapi) {
    attempts.push({
      name: "runapi",
      run: () =>
        generateRunapi({
          apiKey: keys.runapi,
          modelId: "kling-v2.1-standard",
          prompt,
          duration: body.duration,
          aspectRatio: body.aspect_ratio,
          imageUrl: body.image_url,
          enableSound: body.enable_sound,
        }),
    });
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const video = await attempt.run();
      return NextResponse.json({
        ok: true,
        video,
        mime: "video/mp4",
        model: modelId,
        provider: attempt.name,
        usedFallback: attempt.name !== provider,
        errors: errors.length ? errors : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${attempt.name}: ${message}`);
    }
  }

  return NextResponse.json(
    {
      error: "generation_failed",
      message:
        `Provedores de video indisponiveis agora. ${errors.join(" | ")}`.slice(0, 800),
    },
    { status: 502 }
  );
});
