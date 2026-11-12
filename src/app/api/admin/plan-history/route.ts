import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { listPlanHistory } from "@/lib/audit";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || undefined;
  const limit = Number(url.searchParams.get("limit") || "100");

  const history = await listPlanHistory(userId, limit);

  return NextResponse.json({ history });
});
