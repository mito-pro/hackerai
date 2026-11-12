import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiHandler, badRequest, readJson } from "@/lib/errors";
import {
  getAppHost,
  getMaintenance,
  getOtpMailSettings,
  getProviderKeys,
  setMaintenance,
  setProviderKey,
  setProviderSetting,
  setSetting,
  writeSecretSetting,
} from "@/lib/settings";
import { sendTestOtpEmail } from "@/lib/otp";
import { logAudit } from "@/lib/audit";
import { listCompatibleModels, listOllamaModels } from "@/lib/providers";
import { COMPATIBLE_PROVIDERS } from "@/lib/model-registry";
import { z } from "zod";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const keys = await getProviderKeys();
  const mail = await getOtpMailSettings();

  return NextResponse.json({
    providers: {
      groq: { configured: Boolean(keys.groq), masked: mask(keys.groq) },
      google: { configured: Boolean(keys.google), masked: mask(keys.google) },
      openrouter: {
        configured: Boolean(keys.openrouter),
        masked: mask(keys.openrouter),
      },
      cerebras: { configured: Boolean(keys.cerebras), masked: mask(keys.cerebras) },
      sambanova: {
        configured: Boolean(keys.sambanova),
        masked: mask(keys.sambanova),
      },
      nvidia: { configured: Boolean(keys.nvidia), masked: mask(keys.nvidia) },
      opencode: {
        configured: Boolean(keys.opencode),
        masked: mask(keys.opencode),
      },
      vercel: { configured: Boolean(keys.vercel), masked: mask(keys.vercel) },
      runapi: { configured: Boolean(keys.runapi), masked: mask(keys.runapi) },
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
      appHost: await getAppHost(),
    },
    maintenance: await getMaintenance(),
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
  cerebras: z.string().optional(),
  sambanova: z.string().optional(),
  nvidia: z.string().optional(),
    opencode: z.string().optional(),
    vercel: z.string().optional(),
    runapi: z.string().optional(),
  clearProvider: z
    .enum([
      "groq",
      "google",
      "openrouter",
      "cerebras",
      "sambanova",
      "nvidia",
      "opencode",
      "vercel",
      "runapi",
    ])
    .optional(),
  ollamaBaseUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.boolean().optional(),
  mailFrom: z.string().optional(),
  appHost: z.string().optional(),
  maintenanceEnabled: z.boolean().optional(),
  maintenanceMessage: z.string().optional(),
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
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

  if (data.clearProvider) await setProviderKey(data.clearProvider, "");

  if (data.groq?.trim()) await setProviderKey("groq", data.groq.trim());
  if (data.google?.trim()) await setProviderKey("google", data.google.trim());
  if (data.openrouter?.trim())
    await setProviderKey("openrouter", data.openrouter.trim());
  if (data.cerebras?.trim())
    await setProviderKey("cerebras", data.cerebras.trim());
  if (data.sambanova?.trim())
    await setProviderKey("sambanova", data.sambanova.trim());
  if (data.nvidia?.trim()) await setProviderKey("nvidia", data.nvidia.trim());
  if (data.opencode?.trim())
    await setProviderKey("opencode", data.opencode.trim());
  if (data.vercel?.trim())
    await setProviderKey("vercel", data.vercel.trim());
  if (data.runapi?.trim())
    await setProviderKey("runapi", data.runapi.trim());
  if (data.ollamaBaseUrl !== undefined)
    await setProviderSetting("ollamaBaseUrl", data.ollamaBaseUrl.trim());
  if (data.ollamaModel !== undefined)
    await setProviderSetting("ollamaModel", data.ollamaModel.trim());

  if (data.smtpHost !== undefined) await setSetting("otp:smtpHost", data.smtpHost.trim());
  if (data.smtpPort !== undefined)
    await setSetting("otp:smtpPort", String(data.smtpPort));
  if (data.smtpUser !== undefined)
    await setSetting("otp:smtpUser", data.smtpUser.trim());
  if (data.smtpPass !== undefined && data.smtpPass !== "")
    await writeSecretSetting("otp:smtpPass", data.smtpPass);
  if (data.smtpSecure !== undefined)
    await setSetting("otp:smtpSecure", data.smtpSecure ? "true" : "false");
  if (data.mailFrom !== undefined)
    await setSetting("otp:mailFrom", data.mailFrom.trim());
  if (data.appHost !== undefined)
    await setSetting("otp:appHost", data.appHost.trim());
  if (
    data.maintenanceEnabled !== undefined ||
    data.maintenanceMessage !== undefined
  ) {
    const current = await getMaintenance();
    const nextEnabled = data.maintenanceEnabled ?? current.enabled;
    const nextMessage = data.maintenanceMessage ?? current.message;
    await setMaintenance(nextEnabled, nextMessage);
    if (nextEnabled !== current.enabled) {
      await logAudit({
        actorId: admin.id,
        actorEmail: admin.email,
        action: "maintenance.toggle",
        targetType: "settings",
        targetId: "maintenance",
        details: {
          enabled: nextEnabled,
          message: nextMessage,
          previous: current.enabled,
        },
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true });
});

const testSchema = z.object({
  provider: z.enum([
    "groq",
    "google",
    "openrouter",
    "ollama",
    "cerebras",
    "sambanova",
    "nvidia",
    "opencode",
    "vercel",
    "runapi",
    "smtp",
  ]),
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
  const keys = await getProviderKeys();

  if (provider === "smtp") {
    const mail = await getOtpMailSettings();
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

    if (provider === "opencode") {
      if (!keys.opencode) throw new Error("Chave nao configurada");
      const response = await fetch("https://opencode.ai/inference/v1/models", {
        headers: { Authorization: `Bearer ${keys.opencode}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        data?: Array<{
          id?: string;
          cost?: { text?: { input?: { price?: number } } };
        }>;
      };
      const freeModels = (payload.data ?? []).filter(
        (item) => item.cost?.text?.input?.price === 0
      );
      const chat = await fetch(
        "https://opencode.ai/inference/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keys.opencode}`,
          },
          body: JSON.stringify({
            model: "big-pickle",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        }
      );
      if (!chat.ok) {
        const detail = await chat.text();
        return NextResponse.json({
          ok: false,
          message: `OpenCode lista modelos, mas o chat respondeu HTTP ${chat.status}: ${detail.slice(0, 180)}`,
          models: freeModels.map((item) => item.id),
        });
      }
      return NextResponse.json({
        ok: true,
        message: `OpenCode respondendo (${freeModels.length} modelo(s) gratuito(s)).`,
        models: freeModels.map((item) => item.id),
      });
    }

    if (provider === "vercel") {
      if (!keys.vercel) throw new Error("Chave nao configurada");
      const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
        headers: { Authorization: `Bearer ${keys.vercel}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        data?: Array<{ id?: string; type?: string }>;
      };
      const language = (payload.data ?? []).filter(
        (item) => item.type === "language"
      );
      const chat = await fetch(
        "https://ai-gateway.vercel.sh/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keys.vercel}`,
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3.5-lightning-free",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        }
      );
      if (!chat.ok) {
        const detail = await chat.text();
        return NextResponse.json({
          ok: false,
          message: `AI Gateway lista modelos, mas o chat respondeu HTTP ${chat.status}: ${detail.slice(0, 180)}`,
          models: language.slice(0, 20).map((item) => item.id),
        });
      }
      return NextResponse.json({
        ok: true,
        message: `AI Gateway respondendo (${language.length} modelo(s) de linguagem).`,
        models: language.slice(0, 20).map((item) => item.id),
      });
    }

    if (
      provider === "cerebras" ||
      provider === "sambanova" ||
      provider === "nvidia"
    ) {
      const apiKey = keys[provider];
      if (!apiKey) throw new Error("Chave nao configurada");
      const label =
        COMPATIBLE_PROVIDERS.find((item) => item.id === provider)?.label ??
        provider;
      const models = await listCompatibleModels(provider);
      if (models.length === 0) {
        return NextResponse.json({
          ok: false,
          message: `${label} nao devolveu modelos. Revise a chave e a base URL.`,
        });
      }
      return NextResponse.json({
        ok: true,
        message: `${label} respondendo (${models.length} modelo(s)).`,
        models: models.map((model) => model.modelId),
      });
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
