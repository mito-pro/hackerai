import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { createPayment, type Payment } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  planId: z.string().min(1),
  pixKey: z.string().min(1).max(120),
});

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const raw = await request.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Dados invalidos." },
      { status: 400 }
    );
  }

  const payment = await createPayment(
    user.id,
    user.email,
    parsed.data.planId,
    parsed.data.pixKey
  );
  return NextResponse.json({ ok: true, payment });
});
