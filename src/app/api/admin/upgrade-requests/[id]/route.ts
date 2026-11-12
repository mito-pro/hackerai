import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { listUpgradeRequests, resolveUpgradeRequest, sendUpgradeActivationEmail, type UpgradeRequest } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const requests = await listUpgradeRequests();
  return NextResponse.json({ ok: true, requests });
});

const resolveSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  adminNotes: z.string().optional().nullable(),
  pixKey: z.string().optional().nullable(),
});

export const PATCH = apiHandler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  const raw = await request.json();
  const parsed = resolveSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", message: "Dados invalidos." }, { status: 400 });
  }

  const admin = await requireAdmin();
  const updated = await resolveUpgradeRequest(
    id,
    parsed.data.status,
    parsed.data.adminNotes ?? null,
    admin.email,
    parsed.data.pixKey ?? undefined
  );

  if (parsed.data.status === "approved") {
    await sendUpgradeActivationEmail(updated.id);
  }

  return NextResponse.json({ ok: true, request: updated });
});
