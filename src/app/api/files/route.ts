import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { planForUser, rateLimitFor, syncCounters } from "@/lib/usage";
import { writeFileSync, mkdirSync, existsSync, createReadStream, statSync } from "node:fs";
import { join } from "node:path";
import { writableDir } from "@/lib/storage";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "bad_request", message: "Nenhum arquivo enviado." },
      { status: 400 }
    );
  }

  const uploadDir = writableDir("uploads", fresh.id);
  mkdirSync(uploadDir, { recursive: true });

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = join(uploadDir, safeName);
  const bytes = await file.arrayBuffer();
  writeFileSync(filePath, Buffer.from(bytes));

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    savedAs: safeName,
    path: filePath,
    size: bytes.byteLength,
    mime: file.type,
    url: `/api/files/${fresh.id}/${safeName}`,
  });
});

export const GET = apiHandler(async (request: Request) => {
  const user = await requireUser();
  const blocked = await maintenanceBlock(user);
  if (blocked) return blocked;
  const fresh = await syncCounters(user.id);
  if (!fresh) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sessao expirada." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const fileName = segments[segments.length - 1];
  const filePath = join(writableDir("uploads", fresh.id), fileName);

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
