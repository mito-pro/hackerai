import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { planForUser, rateLimitFor, syncCounters } from "@/lib/usage";
import { existsSync, createReadStream, statSync } from "node:fs";
import { join } from "node:path";
import { writableDir } from "@/lib/storage";
import { Readable } from "node:stream";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: Request, { params }: { params: Promise<{ userId: string; fileName: string }> }) => {
  const { userId, fileName } = await params;
  const user = await requireUser();
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;
  if (user.id !== userId) {
    return NextResponse.json(
      { error: "forbidden", message: "Acesso negado a este arquivo." },
      { status: 403 }
    );
  }

  const fresh = await syncCounters(user.id);
  if (!fresh) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sessao expirada." },
      { status: 401 }
    );
  }

  const plan = await planForUser(fresh);
  const rate = checkRateLimit(`file:${fresh.id}`, rateLimitFor(plan));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit",
        message: `Fila cheia: limite de ${rate.limit} requisicoes por minuto.`,
      },
      { status: 429 }
    );
  }

  const filePath = join(writableDir("uploads", userId), fileName);

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "not_found", message: "Arquivo nao encontrado." },
      { status: 404 }
    );
  }

  const stat = statSync(filePath);
  const stream: NodeJS.ReadableStream = Readable.from(createReadStream(filePath));

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(stat.size),
    },
  });
});
