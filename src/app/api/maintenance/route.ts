import { NextResponse } from "next/server";
import { getMaintenance } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const maintenance = await getMaintenance();
  return NextResponse.json({
    enabled: maintenance.enabled,
    message: maintenance.message,
  });
}
