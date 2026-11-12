import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler, readJson } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildFallbackReport,
  generatePentestReport,
  runScan,
  type ScanResult,
} from "@/lib/scanner";

export const runtime = "nodejs";
export const maxDuration = 120;

type ScanBody = {
  url?: unknown;
  authorize?: unknown;
};

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;

  const rate = checkRateLimit(`scan:${user.id}`, 3, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit",
        message: `Fila cheia: maximo 3 varreduras por minuto. Aguarde ${rate.retryInSeconds}s.`,
      },
      { status: 429 }
    );
  }

  const raw = await readJson(request);
  const body = (raw.data ?? {}) as ScanBody;
  const url = String(body.url ?? "").trim();

  if (!url) {
    return NextResponse.json(
      { error: "bad_request", message: "Informe a URL do alvo." },
      { status: 400 }
    );
  }
  if (body.authorize !== true) {
    return NextResponse.json(
      {
        error: "authorization_required",
        message:
          "Confirme que voce tem autorizacao para testar este site antes de rodar o pentest.",
      },
      { status: 400 }
    );
  }

  let scan: ScanResult;
  try {
    scan = await runScan(url);
  } catch (error) {
    console.error("[NEXUS] falha na varredura:", error);
    return NextResponse.json(
      { error: "scan_failed", message: "Falha ao executar a varredura." },
      { status: 500 }
    );
  }

  if (!scan.ok) {
    return NextResponse.json(
      { error: "invalid_target", message: scan.error ?? "Alvo invalido." },
      { status: 400 }
    );
  }

  const aiReport = await generatePentestReport(scan).catch(() => null);
  const report = aiReport ?? buildFallbackReport(scan);

  return NextResponse.json({
    ok: true,
    scan,
    report,
    aiGenerated: Boolean(aiReport),
  });
});
