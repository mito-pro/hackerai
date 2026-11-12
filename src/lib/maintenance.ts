import { NextResponse } from "next/server";
import { getMaintenance } from "./settings";

export type MaintenanceState = {
  enabled: boolean;
  message: string;
};

export async function maintenanceState(): Promise<MaintenanceState> {
  return getMaintenance();
}

export async function maintenanceBlock(user: {
  role?: string;
} | null): Promise<NextResponse | null> {
  if (!user || user.role === "admin") return null;
  const state = await getMaintenance();
  if (!state.enabled) return null;
  return NextResponse.json(
    { error: "maintenance", message: state.message },
    { status: 503 }
  );
}
