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

type ImageBody = {
  model?: string;
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
};

const NVIDIA_IMAGE_BASE = "https://ai.api.nvidia.com/v1/genai";
const RUNPI_IMAGE_BASE = "https://runapi.ai/v1";
const POLLINATIONS_IMAGE_BASE = "https://image.pollinations.ai/prompt";
const DEFAULT_MODEL = "pollinations/flux";

const clampSize = (value: number | undefined, fallback: number) => {
  const size = Number(value);
  if (!Number.isFinite(size)) return fallback;
  return Math.min(2048, Math.max(256, Math.round(size)));
};

async function bytesToDataUri(response: Response) {
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.byteLength) return null;
  const mime = contentType.startsWith("image/")
    ? contentType
    : "image/png";
  return {
    image: `data:${mime};base64,${buffer.toString("base64")}`,
    mime,
  };
}

async function generatePollinations(options: {
  prompt: string;
  width: number;
  height: number;
  model: string;
  seed?: number;
}) {
  const params = new URLSearchParams({
    width: String(options.width),
    height: String(options.height),
    nologo: "true",
    referrer: "hackerai-nexus",
  });
  if (options.model) params.set("model", options.model);
  if (Number.isFinite(options.seed)) params.set("seed", String(options.seed));

  const url = `${POLLINATIONS_IMAGE_BASE}/${encodeURIComponent(options.prompt)}?${params.toString()}`;

  // Limite gratuito do Pollinations: 1 imagem a cada 45s por IP.
  // Espera e tenta de novo antes de desistir do provedor.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(180_000),
      headers: { Accept: "image/*" },
    });

    if (response.ok) {
      const parsed = await bytesToDataUri(response);
      if (!parsed) throw new Error("Pollinations nao retornou imagem.");
      return parsed;
    }

    const errorText = await response.text();
    const limited = response.status === 402 || response.status === 429;
    if (!limited || attempt === 2) {
      throw new Error(`Pollinations HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const waitMatch = errorText.match(/Retry after (\d+)s/i);
    const waitSeconds = waitMatch ? Number(waitMatch[1]) + 2 : 45;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(Math.max(waitSeconds, 5), 70) * 1000)
    );
  }

  throw new Error("Pollinations: limite gratuito atingido.");
}

async function generateNvidia(options: {
  apiKey: string;
  modelId: string;
  prompt: string;
  width: number;
  height: number;
}) {
  const response = await fetch(`${NVIDIA_IMAGE_BASE}/${options.modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: options.prompt,
      width: options.width,
      height: options.height,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    artifacts?: Array<{ base64?: string }>;
    data?: Array<{ b64_json?: string; url?: string }>;
    images?: Array<{ b64_json?: string; url?: string; image_url?: string }>;
    image?: string;
    image_url?: string;
    url?: string;
  };

  const artifact =
    payload?.artifacts?.[0]?.base64 ??
    payload?.data?.[0]?.b64_json ??
    payload?.images?.[0]?.b64_json ??
    payload?.images?.[0]?.image_url ??
    payload?.image ??
    "";
  if (artifact) {
    const isBase64 = !artifact.startsWith("http");
    return isBase64
      ? { image: `data:image/png;base64,${artifact}`, mime: "image/png" }
      : { image: artifact, mime: "image/png" };
  }

  const remoteUrl =
    payload?.data?.[0]?.url ?? payload?.url ?? payload?.image_url ?? "";
  if (!remoteUrl) throw new Error("NVIDIA nao retornou imagem.");
  return { image: remoteUrl, mime: "image/png" };
}

async function generateRunapi(options: {
  apiKey: string;
  modelId: string;
  prompt: string;
  width: number;
  height: number;
}) {
  const response = await fetch(`${RUNPI_IMAGE_BASE}/${options.modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: options.prompt,
      width: options.width,
      height: options.height,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunAPI HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    b64_json?: string;
    image_url?: string;
    url?: string;
  };
  const imageData =
    payload?.data?.[0]?.b64_json ??
    payload?.data?.[0]?.url ??
    payload?.b64_json ??
    payload?.image_url ??
    payload?.url ??
    "";
  if (!imageData) throw new Error("RunAPI nao retornou imagem.");
  const isBase64 = !imageData.startsWith("http");
  return isBase64
    ? { image: `data:image/png;base64,${imageData}`, mime: "image/png" }
    : { image: imageData, mime: "image/png" };
}

function providerOf(modelId: string): "pollinations" | "nvidia" | "runapi" {
  if (modelId.startsWith("nvidia/")) return "nvidia";
  if (modelId.startsWith("runapi/")) return "runapi";
  return "pollinations";
}

function modelPayload(modelId: string): string {
  if (modelId.startsWith("pollinations/")) return modelId.slice("pollinations/".length);
  if (modelId.startsWith("runapi/")) return modelId.slice("runapi/".length);
  if (modelId.startsWith("nvidia/")) return modelId.slice("nvidia/".length);
  return "flux";
}

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
  const modelId = body.model?.trim() || DEFAULT_MODEL;
  const provider = providerOf(modelId);
  const registryDef = findModel(modelId);
  const payloadModel =
    registryDef && registryDef.provider === provider && registryDef.modelId
      ? registryDef.modelId
      : modelPayload(modelId);
  const width = clampSize(body.width, 1024);
  const height = clampSize(body.height, 1024);

  const attempts: Array<{ name: string; run: () => Promise<{ image: string; mime: string }> }> = [];

  if (provider === "runapi") {
    if (keys.runapi) {
      attempts.push({
        name: "runapi",
        run: () =>
          generateRunapi({
            apiKey: keys.runapi,
            modelId: payloadModel,
            prompt,
            width,
            height,
          }),
      });
    }
  }

  if (provider === "nvidia") {
    if (keys.nvidia) {
      attempts.push({
        name: "nvidia",
        run: () =>
          generateNvidia({
            apiKey: keys.nvidia,
            modelId: payloadModel,
            prompt,
            width,
            height,
          }),
      });
    }
  }

  attempts.push({
    name: "pollinations",
    run: () =>
      generatePollinations({
        prompt,
        width,
        height,
        model: provider === "pollinations" ? payloadModel : "flux",
        seed: body.seed,
      }),
  });

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = await attempt.run();
      return NextResponse.json({
        ok: true,
        image: result.image,
        mime: result.mime,
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
      message: `Falha em todos os provedores. ${errors.join(" | ")}`.slice(0, 800),
    },
    { status: 500 }
  );
});
