import { NextResponse } from "next/server";
import { z } from "zod";
import { spawnSync } from "node:child_process";
import path from "node:path";
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
  const keys = await getProviderKeys();
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
  action: z.enum(["command", "start", "setup"]).default("command"),
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

  if (action === "setup") {
    const script = path.join(process.cwd(), "scripts", "omega-setup.mjs");
    let setupOutput = "";
    try {
      const setup = spawnSync("node", [script], {
        stdio: "pipe",
        encoding: "utf8",
        shell: process.platform === "win32",
        timeout: 300_000,
      });
      setupOutput = String(setup.stdout || setup.stderr || "").trim();
      if (setup.status !== 0) {
        return NextResponse.json(
          {
            ok: false,
            message: setupOutput || "Falha ao baixar o repo heretic.",
            hint: setup.error
              ? "Verifique se o git esta instalado e ha acesso a internet."
              : null,
          },
          { status: 400 }
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        {
          ok: false,
          message: "Falha ao executar o setup do repo heretic.",
          hint: message.includes("ENOENT")
            ? "O git ou o node nao foram encontrados no PATH."
            : "Erro de rede ao baixar o repo. Tente novamente ou clone manualmente.",
        },
        { status: 400 }
      );
    }

    const result = startOmegaDecensor(model, { quantization });
    return NextResponse.json(
      {
        ok: result.ok,
        message: `${setupOutput}\n${result.message}`,
        job: result.job,
      },
      { status: result.ok ? 200 : 400 }
    );
  }

  const result = startOmegaDecensor(model, { quantization });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
});
