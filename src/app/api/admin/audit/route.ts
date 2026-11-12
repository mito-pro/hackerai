import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { listAuditLogs } from "@/lib/audit";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "200");
  const action = url.searchParams.get("action") || undefined;
  const targetType = url.searchParams.get("targetType") || undefined;
  const targetId = url.searchParams.get("targetId") || undefined;

  const logs = await listAuditLogs({ limit, action, targetType, targetId });

  return NextResponse.json({ logs });
});
