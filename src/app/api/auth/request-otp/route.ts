import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOtpCode, RESEND_COOLDOWN_SECONDS } from "@/lib/otp";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().min(3).max(160),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "E-mail invalido." },
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  const host = request.headers.get("host");

  try {
    const result = await requestOtpCode(parsed.data.email, ip, host);

    if (!result.ok) {
      const status = result.code === "invalid_email" ? 400 : 429;
      return NextResponse.json(
        {
          error: result.code ?? "otp_request_failed",
          message: result.error,
          retryAfter: result.retryAfter,
        },
        { status }
      );
    }

    // Sem SMTP o codigo e gerado e impresso nos logs do servidor; ele segue
    // valido (TTL + tentativas). O cliente recebe ok e o operador usa o
    // codigo do log para concluir o login.
    return NextResponse.json({
      ok: true,
      expiresAt: result.expiresAt,
      emailSent: result.emailSent,
      devCode: result.devCode,
      deliveryFallback: !result.emailSent,
      retryAfter: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error("[NEXUS] falha ao solicitar OTP:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Falha ao solicitar o codigo." },
      { status: 500 }
    );
  }
}
