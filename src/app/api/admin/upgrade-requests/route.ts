import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { listUpgradeRequests } from "@/lib/payments";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const requests = await listUpgradeRequests();
  return NextResponse.json({ ok: true, requests });
});
