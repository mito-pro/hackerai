import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler, badRequest, readJson } from "@/lib/errors";
import {
  getAppHost,
  getOtpMailSettings,
  getProviderKeys,
  setProviderKey,
  setProviderSetting,
  setSetting,
  writeSecretSetting,
} from "@/lib/settings";
import { sendTestOtpEmail } from "@/lib/otp";
import { listOllamaModels } from "@/lib/providers";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const keys = getProviderKeys();
  const mail = getOtpMailSettings();

  return NextResponse.json({
    providers: {
      groq: { configured: Boolean(keys.groq), masked: mask(keys.groq) },
      google: { configured: Boolean(keys.google), masked: mask(keys.google) },
      openrouter: {
        configured: Boolean(keys.openrouter),
        masked: mask(keys.openrouter),
      },
      ollama: {
        configured: keys.ollamaConfigured,
        baseUrl: keys.ollamaBaseUrl,
        model: keys.ollamaModel,
      },
    },
    otp: {
      smtpHost: mail?.host ?? "",
      smtpPort: mail?.port ?? 587,
      smtpUser: mail?.user ?? "",
      smtpFrom: mail?.from ?? "",
      smtpSecure: mail?.secure ?? false,
      hasPassword: Boolean(mail?.pass),
      appHost: getAppHost(),
    },
  });
});

function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}****`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function addressFrom(value: string) {
  const match = value.match(/<([^>]+)>/);
  const address = (match ? match[1] : value).trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) ? address : "";
}

const payloadSchema = z.object({
  groq: z.string().optional(),
  google: z.string().optional(),
  openrouter: z.string().optional(),
  clearProvider: z.enum(["groq", "google", "openrouter"]).optional(),
  ollamaBaseUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.boolean().optional(),
  mailFrom: z.string().optional(),
  appHost: z.string().optional(),
});

export const PUT = apiHandler(async (request: Request) => {
  await requireAdmin();
  const raw = await readJson(request);
  if (!raw.ok) return badRequest();
  const parsed = payloadSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Payload invalido." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.clearProvider) setProviderKey(data.clearProvider, "");

  if (data.groq?.trim()) setProviderKey("groq", data.groq.trim());
  if (data.google?.trim()) setProviderKey("google", data.google.trim());
  if (data.openrouter?.trim())
    setProviderKey("openrouter", data.openrouter.trim());
  if (data.ollamaBaseUrl !== undefined)
    setProviderSetting("ollamaBaseUrl", data.ollamaBaseUrl.trim());
  if (data.ollamaModel !== undefined)
    setProviderSetting("ollamaModel", data.ollamaModel.trim());

  if (data.smtpHost !== undefined) setSetting("otp:smtpHost", data.smtpHost.trim());
  if (data.smtpPort !== undefined)
    setSetting("otp:smtpPort", String(data.smtpPort));
  if (data.smtpUser !== undefined)
    setSetting("otp:smtpUser", data.smtpUser.trim());
  if (data.smtpPass !== undefined && data.smtpPass !== "")
    writeSecretSetting("otp:smtpPass", data.smtpPass);
  if (data.smtpSecure !== undefined)
    setSetting("otp:smtpSecure", data.smtpSecure ? "true" : "false");
  if (data.mailFrom !== undefined)
    setSetting("otp:mailFrom", data.mailFrom.trim());
  if (data.appHost !== undefined)
    setSetting("otp:appHost", data.appHost.trim());

  return NextResponse.json({ ok: true });
});

const testSchema = z.object({
  provider: z.enum(["groq", "google", "openrouter", "ollama", "smtp"]),
  email: z.string().optional(),
});

export const POST = apiHandler(async (request: Request) => {
  await requireAdmin();
  const raw = await readJson(request);
  if (!raw.ok) return badRequest("Provedor invalido.");
  const parsed = testSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: "Provedor invalido." },
      { status: 400 }
    );
  }

  const provider = parsed.data.provider;
  const keys = getProviderKeys();

  if (provider === "smtp") {
    const mail = getOtpMailSettings();
    if (!mail) {
      return NextResponse.json(
        { ok: false, message: "SMTP nao configurado." },
        { status: 200 }
      );
    }

    const target =
      parsed.data.email?.trim() ||
      addressFrom(mail.user) ||
      addressFrom(mail.from) ||
      "";

    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Informe um e-mail de destino ou use um usuario/remetente com endereco valido.",
        },
        { status: 200 }
      );
    }

    try {
      const sent = await sendTestOtpEmail(target);
      return NextResponse.json({
        ok: true,
        message: `E-mail de teste enviado para ${target}.`,
        code: sent.code,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { ok: false, message: `Falha no envio: ${message}` },
        { status: 200 }
      );
    }
  }

  try {
    if (provider === "groq") {
      if (!keys.groq) throw new Error("Chave nao configurada");
      const response = await fetch(
        "https://api.groq.com/openai/v1/models",
        { headers: { Authorization: `Bearer ${keys.groq}` } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return NextResponse.json({ ok: true, message: "Groq respondendo." });
    }

    if (provider === "openrouter") {
      if (!keys.openrouter) throw new Error("Chave nao configurada");
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${keys.openrouter}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return NextResponse.json({ ok: true, message: "OpenRouter respondendo." });
    }

    if (provider === "google") {
      if (!keys.google) throw new Error("Chave nao configurada");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${keys.google}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return NextResponse.json({ ok: true, message: "Google AI respondendo." });
    }

    const models = await listOllamaModels();
    const configured = keys.ollamaModel;
    if (configured && models.length > 0 && !models.includes(configured)) {
      return NextResponse.json({
        ok: false,
        message: `Ollama respondendo, mas o modelo "${configured}" nao esta instalado. Disponiveis: ${models.join(", ")}`,
        models,
      });
    }

    return NextResponse.json({
      ok: true,
      message: models.length
        ? `Ollama respondendo (${models.length} modelo(s)).`
        : "Ollama respondendo.",
      models,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, message: `Falha ao testar: ${message}` },
      { status: 200 }
    );
  }
});
