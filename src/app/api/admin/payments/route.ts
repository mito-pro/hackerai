import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { listPayments } from "@/lib/payments";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const payments = await listPayments();
  return NextResponse.json({ ok: true, payments });
});
