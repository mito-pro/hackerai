import { NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { apiHandler, readJson } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPlan, hasCapability } from "@/lib/plans";
import { pentestEnabled } from "@/lib/scan-config";
import { listScanHistory, saveScanHistory } from "@/lib/scan-history";
import { generateId } from "@/lib/utils";
import {
  applyReviews,
  buildFallbackReport,
  generatePentestReport,
  reviewFindings,
  runScan,
  type ScanResult,
} from "@/lib/scanner";

export const runtime = "nodejs";
export const maxDuration = 180;

type ScanBody = {
  url?: unknown;
  authorize?: unknown;
};

export const GET = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";
  if (wantsAll) {
    await requireAdmin();
    return NextResponse.json({
      ok: true,
      history: await listScanHistory(null, 50),
      enabled: await pentestEnabled(),
    });
  }
  return NextResponse.json({
    ok: true,
    history: await listScanHistory(user.id, 15),
    enabled: await pentestEnabled(),
  });
});

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;

  if (!(await pentestEnabled())) {
    return NextResponse.json(
      {
        error: "module_disabled",
        message: "Modulo de pentest desativado pelo administrador.",
      },
      { status: 403 }
    );
  }

  const plan = await getPlan(user.planId);
  const allowed = user.role === "admin" || (plan ? hasCapability(plan, "pentest") : false);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "plan_without_pentest",
        message:
          "Seu plano nao inclui pentest. Fale com o suporte ou faca upgrade em /plano-mudanca/.",
      },
      { status: 403 }
    );
  }

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

  // Fase 2 (metodo Redstrike): revisor independente re-julga cada achado.
  const verdicts = await reviewFindings(scan).catch(() => null);
  if (verdicts) scan = applyReviews(scan, verdicts);

  // Fase 3: relatorio do executor sobre o conjunto revisado.
  const aiReport = await generatePentestReport(scan).catch(() => null);
  const report = aiReport ?? buildFallbackReport(scan);

  const criticals = scan.findings.filter(
    (f) => f.severity === "critical" && f.review?.verdict !== "rejected"
  ).length;
  const highs = scan.findings.filter(
    (f) => f.severity === "high" && f.review?.verdict !== "rejected"
  ).length;

  await saveScanHistory({
    id: generateId("scn"),
    userId: user.id,
    userEmail: user.email,
    url: scan.url,
    score: scan.score,
    findingsCount: scan.findings.length,
    criticals,
    highs,
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    scan,
    report,
    aiGenerated: Boolean(aiReport),
    reviewed: Boolean(verdicts),
  });
});

