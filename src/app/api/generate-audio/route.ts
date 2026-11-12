import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiHandler } from "@/lib/errors";
import { maintenanceBlock } from "@/lib/maintenance";
import { checkRateLimit } from "@/lib/rate-limit";
import { planForUser, rateLimitFor, syncCounters } from "@/lib/usage";
import { getProviderKeys } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

type AudioBody = {
  model?: string;
  text: string;
  voice?: string;
  lang?: string;
};

const MAX_CHARS = 4000;
const DEFAULT_MODEL = "google-tts/pt";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type GeneratedAudio = { audio: string; mime: string };

function chunkText(text: string, size = 180): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > size) {
    let cut = rest.lastIndexOf(". ", size);
    if (cut < Math.floor(size * 0.5)) cut = rest.lastIndexOf("! ", size);
    if (cut < Math.floor(size * 0.5)) cut = rest.lastIndexOf("? ", size);
    if (cut < Math.floor(size * 0.5)) cut = rest.lastIndexOf(" ", size);
    if (cut < Math.floor(size * 0.5)) cut = size;
    else cut += 1;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

function toDataUri(buffer: Buffer, mime: string) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function generateGoogleTts(options: {
  text: string;
  lang: string;
}): Promise<GeneratedAudio> {
  const chunks = chunkText(options.text);
  if (!chunks.length) throw new Error("Texto vazio.");

  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    const url =
      "https://translate.google.com/translate_tts" +
      `?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(options.lang)}` +
      `&q=${encodeURIComponent(chunk)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Referer: "https://translate.google.com/",
        Accept: "audio/mpeg, audio/*;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(45_000),
    });
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok || contentType.includes("text/html")) {
      throw new Error(`Google TTS HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.byteLength) throw new Error("Google TTS retornou audio vazio.");
    parts.push(buffer);
  }

  return { audio: toDataUri(Buffer.concat(parts), "audio/mpeg"), mime: "audio/mpeg" };
}

async function generateStreamElements(options: {
  text: string;
  voice: string;
}): Promise<GeneratedAudio> {
  const url =
    "https://api.streamelements.com/kappa/v2/speech" +
    `?voice=${encodeURIComponent(options.voice)}` +
    `&text=${encodeURIComponent(options.text)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "audio/mpeg, audio/*" },
    signal: AbortSignal.timeout(60_000),
  });
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!response.ok || contentType.includes("application/json")) {
    throw new Error(`StreamElements HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.byteLength) throw new Error("StreamElements retornou audio vazio.");
  return { audio: toDataUri(buffer, "audio/mpeg"), mime: "audio/mpeg" };
}

async function generatePollinations(options: {
  text: string;
  voice: string;
}): Promise<GeneratedAudio> {
  const url =
    `https://gen.pollinations.ai/audio/${encodeURIComponent(options.text)}` +
    `?voice=${encodeURIComponent(options.voice)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "audio/mpeg, audio/*" },
    signal: AbortSignal.timeout(60_000),
  });
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!response.ok || contentType.includes("application/json")) {
    throw new Error(`Pollinations HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.byteLength) throw new Error("Pollinations retornou audio vazio.");
  return { audio: toDataUri(buffer, "audio/mpeg"), mime: "audio/mpeg" };
}

async function generateRunapi(options: {
  apiKey: string;
  model: string;
  text: string;
  voice: string;
}): Promise<GeneratedAudio> {
  const response = await fetch("https://runapi.ai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      input: options.text,
      voice: options.voice,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("audio")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { audio: toDataUri(buffer, "audio/mpeg"), mime: "audio/mpeg" };
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunAPI HTTP ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    audio?: string;
    url?: string;
    data?: Array<{ audio?: string; url?: string; b64_json?: string }>;
  };
  const audioData =
    payload?.audio ??
    payload?.url ??
    payload?.data?.[0]?.audio ??
    payload?.data?.[0]?.url ??
    payload?.data?.[0]?.b64_json ??
    "";
  if (!audioData) throw new Error("RunAPI nao retornou audio.");
  const isBase64 = !audioData.startsWith("http");
  return isBase64
    ? { audio: `data:audio/mpeg;base64,${audioData}`, mime: "audio/mpeg" }
    : { audio: audioData, mime: "audio/mpeg" };
}

function providerOf(modelId: string): "google-tts" | "pollinations" | "streamelements" | "runapi" {
  if (modelId.startsWith("pollinations/")) return "pollinations";
  if (modelId.startsWith("streamelements/")) return "streamelements";
  if (modelId.startsWith("runapi/")) return "runapi";
  return "google-tts";
}

function langOf(modelId: string): string {
  if (modelId.startsWith("google-tts/")) {
    const lang = modelId.slice("google-tts/".length).trim();
    if (lang) return lang;
  }
  return "pt";
}

export const POST = apiHandler(async (request: Request) => {
  let body: AudioBody;
  try {
    body = (await request.json()) as AudioBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "bad_request", message: "Texto vazio." },
      { status: 400 }
    );
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: `Texto longo demais: maximo de ${MAX_CHARS} caracteres.`,
      },
      { status: 400 }
    );
  }

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
  const rate = checkRateLimit(`audio:${fresh.id}`, rateLimitFor(plan));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit",
        message: `Fila cheia: limite de ${rate.limit} requisicoes por minuto.`,
      },
      { status: 429 }
    );
  }

  const keys = await getProviderKeys();
  const modelId = body.model?.trim() || DEFAULT_MODEL;
  const provider = providerOf(modelId);
  const lang = (body.lang || langOf(modelId)).slice(0, 5);
  const voice = (body.voice || "").trim();

  const attempts: Array<{ name: string; run: () => Promise<GeneratedAudio> }> = [];

  if (provider === "runapi" && keys.runapi) {
    attempts.push({
      name: "runapi",
      run: () =>
        generateRunapi({
          apiKey: keys.runapi,
          model: modelId.replace("runapi/", ""),
          text,
          voice: voice || "alloy",
        }),
    });
  }

  if (provider === "pollinations") {
    attempts.push({
      name: "pollinations",
      run: () => generatePollinations({ text, voice: voice || "nova" }),
    });
  }

  if (provider === "streamelements") {
    attempts.push({
      name: "streamelements",
      run: () => generateStreamElements({ text, voice: voice || "Brian" }),
    });
  }

  attempts.push({
    name: "google-tts",
    run: () => generateGoogleTts({ text, lang }),
  });

  if (provider !== "streamelements") {
    attempts.push({
      name: "streamelements",
      run: () => generateStreamElements({ text, voice: voice || "Brian" }),
    });
  }

  if (provider !== "pollinations") {
    attempts.push({
      name: "pollinations",
      run: () => generatePollinations({ text, voice: voice || "nova" }),
    });
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = await attempt.run();
      return NextResponse.json({
        ok: true,
        audio: result.audio,
        mime: result.mime,
        model: modelId,
        provider: attempt.name,
        usedFallback: attempt.name !== provider,
        errors: errors.length ? errors : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${attempt.name}: ${message}`);
    }
  }

  return NextResponse.json(
    {
      error: "generation_failed",
      message: `Falha em todos os provedores. ${errors.join(" | ")}`.slice(0, 800),
    },
    { status: 500 }
  );
});
