import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { apiHandler, badRequest, readJson } from "@/lib/errors";
import { getProviderKeys } from "@/lib/settings";
import {
  decensorCommand,
  hereticRepoStatus,
  isUncensoredTag,
  listOllamaTags,
  omegaJobStatus,
  startOmegaDecensor,
} from "@/lib/omega";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();

  const repo = hereticRepoStatus();
  const keys = getProviderKeys();
  let models: string[] = [];
  let ollamaError = "";

  if (keys.ollamaConfigured) {
    try {
      models = await listOllamaTags();
    } catch (error) {
      ollamaError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json({
    repo,
    ollama: {
      configured: keys.ollamaConfigured,
      baseUrl: keys.ollamaBaseUrl,
      error: ollamaError,
      models,
      uncensored: models.filter(isUncensoredTag),
    },
    job: omegaJobStatus(),
  });
});

const payloadSchema = z.object({
  action: z.enum(["command", "start"]).default("command"),
  model: z.string().min(1),
  quantization: z.string().optional(),
});

export const POST = apiHandler(async (request: Request) => {
  await requireAdmin();

  const raw = await readJson(request);
  if (!raw.ok) return badRequest();
  const parsed = payloadSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const { action, model, quantization } = parsed.data;

  if (action === "command") {
    return NextResponse.json({
      ok: true,
      command: decensorCommand(model, { quantization }),
    });
  }

  const result = startOmegaDecensor(model, { quantization });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
});
