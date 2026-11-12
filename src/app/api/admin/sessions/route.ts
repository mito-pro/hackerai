import { NextResponse } from "next/server";
import { listSessions, requireAdmin, revokeSession } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const sessions = await listSessions();
  return NextResponse.json({ sessions });
});

export const DELETE = apiHandler(async (request: Request) => {
  await requireAdmin();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "bad_request", message: "Informe o id da sessao." },
      { status: 400 }
    );
  }
  const revoked = await revokeSession(id);
  return NextResponse.json({ ok: revoked });
});
