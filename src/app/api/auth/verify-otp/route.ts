import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { verifyOtpCode } from "@/lib/otp";
import { get } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { usageSummary, syncCounters } from "@/lib/usage";
import { sendWelcomeMail } from "@/lib/mail";
import { getAppHost } from "@/lib/settings";
import type { UserRow } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().min(3).max(160),
  code: z.string().min(4).max(12),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    const existingUser = await get<UserRow>(
      "SELECT * FROM users WHERE email = ?",
      [body.email.trim().toLowerCase()]
    );
    const isNewUser = !existingUser;

    const result = await verifyOtpCode(body.email, body.code);

    if (!result.ok || !result.userId) {
      return NextResponse.json(
        { error: "otp_invalid", message: result.error },
        { status: 401 }
      );
    }

    const user = await get<UserRow>("SELECT * FROM users WHERE id = ?", [result.userId]);
    if (!user) {
      return NextResponse.json(
        { error: "user_not_found", message: "Usuario nao encontrado." },
        { status: 404 }
      );
    }
    if (user.status !== "active") {
      return NextResponse.json(
        { error: "account_banned", message: "Conta bloqueada pelo administrador." },
        { status: 403 }
      );
    }

    await createSession(user.id, request.headers.get("user-agent"));

    const fresh = await syncCounters(user.id) ?? user;
    const plan = await getPlan(fresh.plan_id) ?? (await getPlan("free"))!;

    if (isNewUser) {
      sendWelcomeMail({
        email: fresh.email,
        name: fresh.name,
        planName: plan.name,
        role: fresh.role,
        appHost: await getAppHost() || "hackerai-nexus.vercel.app",
      }).catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: fresh.id,
        email: fresh.email,
        name: fresh.name,
        role: fresh.role,
        plan: plan.name,
      },
      usage: usageSummary(fresh, plan),
    });
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Codigo invalido." },
      { status: 400 }
    );
  }
}
