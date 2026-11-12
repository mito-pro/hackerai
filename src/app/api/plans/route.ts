import { NextResponse } from "next/server";
import { listPlans } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ plans: await listPlans() });
}
