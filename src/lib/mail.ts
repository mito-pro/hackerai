import nodemailer from "nodemailer";
import { getOtpMailSettings } from "./settings";

export type WelcomeMailParams = {
  email: string;
  name: string;
  planName: string;
  role: string;
  appHost: string;
};

export type PlanChangeMailParams = {
  email: string;
  name: string;
  oldPlan: string;
  newPlan: string;
  changedBy: string;
  appHost: string;
};

export type AccountCreatedMailParams = {
  email: string;
  name: string;
  planName: string;
  role: string;
  createdBy: string;
  appHost: string;
};

function escapeHtml(value: string) {
  const amp = String.fromCharCode(38);
  return value
    .replace(/&/g, `${amp}amp;`)
    .replace(/</g, `${amp}lt;`)
    .replace(/>/g, `${amp}gt;`)
    .replace(/"/g, `${amp}quot;`)
    .replace(/'/g, `${amp}#39;`);
}

async function buildTransporter() {
  const settings = await getOtpMailSettings();
  if (!settings) return null;
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

function mailWrapper(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#04070a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#04070a;padding:28px 12px;">
<tr>
<td align="center" style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:#0a1016;border:1px solid #17262f;border-radius:14px;font-family:'JetBrains Mono','Fira Code',Consolas,monospace;overflow:hidden;">
<tr>
<td style="padding:22px 28px;border-bottom:1px solid #17262f;background-color:#070c11;">
<p style="margin:0;font-size:17px;letter-spacing:0.26em;color:#00ff9c;text-transform:uppercase;">HACKER AI</p>
<p style="margin:8px 0 0;font-size:11px;letter-spacing:0.22em;color:#7d8f9b;text-transform:uppercase;">// nexus system</p>
</td>
</tr>
<tr>
<td style="padding:26px 28px;">
${content}
</td>
</tr>
<tr>
<td style="padding:20px 28px;border-top:1px solid #17262f;">
<p style="margin:0;font-size:11px;line-height:1.7;color:#5f7079;">
Esta e uma mensagem automatica. Nao responda a este e-mail.
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export async function sendWelcomeMail(params: WelcomeMailParams) {
  const transporter = (await buildTransporter());
  if (!transporter) return false;

  const content = `
<p style="margin:0;font-size:12px;letter-spacing:0.14em;color:#00ff9c;text-transform:uppercase;">[ system message ] — conta criada</p>
<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#d7e3ea;">Ola, ${escapeHtml(params.name)}.</p>
<p style="margin:10px 0 0;font-size:13.5px;line-height:1.75;color:#9fb1bd;">
Sua conta no <span style="color:#00ff9c;">${escapeHtml(params.appHost)}</span> foi criada com sucesso.
</p>
<table style="width:100%;border-collapse:collapse;margin:18px 0;">
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">e-mail</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#d7e3ea;font-size:12px;text-align:right;">${escapeHtml(params.email)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">plano</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#00ff9c;font-size:12px;text-align:right;">${escapeHtml(params.planName)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">papel</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#d7e3ea;font-size:12px;text-align:right;">${escapeHtml(params.role)}</td></tr>
<tr><td style="padding:8px 0;color:#7d8f9b;font-size:12px;">status</td><td style="padding:8px 0;color:#00ff9c;font-size:12px;text-align:right;">ativo</td></tr>
</table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.75;color:#9fb1bd;">
Faca login com seu e-mail para receber o codigo OTP de acesso.
</p>
`;

  try {
    await transporter.sendMail({
      from: (await getOtpMailSettings())?.from,
      to: params.email,
      subject: `[HACKER AI] Bem-vindo :: ${params.appHost}`,
      html: mailWrapper("Bem-vindo", content),
      text: `HACKER AI :: Conta criada\n\nOla ${params.name},\n\nSua conta foi criada com sucesso.\n\nE-mail: ${params.email}\nPlano: ${params.planName}\nPapel: ${params.role}\nStatus: ativo\n\nFaca login com seu e-mail para receber o codigo OTP.`,
    });
    return true;
  } catch (error) {
    console.error("[NEXUS] falha ao enviar e-mail de boas-vindas:", error);
    return false;
  }
}

export async function sendPlanChangeMail(params: PlanChangeMailParams) {
  const transporter = (await buildTransporter());
  if (!transporter) return false;

  const content = `
<p style="margin:0;font-size:12px;letter-spacing:0.14em;color:#ffb347;text-transform:uppercase;">[ system message ] — plano alterado</p>
<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#d7e3ea;">Ola, ${escapeHtml(params.name)}.</p>
<p style="margin:10px 0 0;font-size:13.5px;line-height:1.75;color:#9fb1bd;">
Seu plano foi alterado no <span style="color:#00ff9c;">${escapeHtml(params.appHost)}</span>.
</p>
<table style="width:100%;border-collapse:collapse;margin:18px 0;">
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">plano anterior</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#9fb1bd;font-size:12px;text-align:right;">${escapeHtml(params.oldPlan)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">novo plano</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#00ff9c;font-size:12px;text-align:right;">${escapeHtml(params.newPlan)}</td></tr>
<tr><td style="padding:8px 0;color:#7d8f9b;font-size:12px;">alterado por</td><td style="padding:8px 0;color:#d7e3ea;font-size:12px;text-align:right;">${escapeHtml(params.changedBy)}</td></tr>
</table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.75;color:#9fb1bd;">
Os novos limites ja estao ativos na sua conta.
</p>
`;

  try {
    await transporter.sendMail({
      from: (await getOtpMailSettings())?.from,
      to: params.email,
      subject: `[HACKER AI] Plano alterado :: ${params.newPlan}`,
      html: mailWrapper("Plano alterado", content),
      text: `HACKER AI :: Plano alterado\n\nOla ${params.name},\n\nSeu plano foi alterado.\n\nPlano anterior: ${params.oldPlan}\nNovo plano: ${params.newPlan}\nAlterado por: ${params.changedBy}\n\nOs novos limites ja estao ativos.`,
    });
    return true;
  } catch (error) {
    console.error("[NEXUS] falha ao enviar e-mail de mudanca de plano:", error);
    return false;
  }
}

export async function sendAccountCreatedMail(params: AccountCreatedMailParams) {
  const transporter = (await buildTransporter());
  if (!transporter) return false;

  const content = `
<p style="margin:0;font-size:12px;letter-spacing:0.14em;color:#00ff9c;text-transform:uppercase;">[ system message ] — conta criada pelo admin</p>
<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#d7e3ea;">Ola, ${escapeHtml(params.name)}.</p>
<p style="margin:10px 0 0;font-size:13.5px;line-height:1.75;color:#9fb1bd;">
Uma conta foi criada para voce no <span style="color:#00ff9c;">${escapeHtml(params.appHost)}</span>.
</p>
<table style="width:100%;border-collapse:collapse;margin:18px 0;">
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">e-mail</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#d7e3ea;font-size:12px;text-align:right;">${escapeHtml(params.email)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">plano</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#00ff9c;font-size:12px;text-align:right;">${escapeHtml(params.planName)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#7d8f9b;font-size:12px;">papel</td><td style="padding:8px 0;border-bottom:1px solid #17262f;color:#d7e3ea;font-size:12px;text-align:right;">${escapeHtml(params.role)}</td></tr>
<tr><td style="padding:8px 0;color:#7d8f9b;font-size:12px;">criada por</td><td style="padding:8px 0;color:#d7e3ea;font-size:12px;text-align:right;">${escapeHtml(params.createdBy)}</td></tr>
</table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.75;color:#9fb1bd;">
Faca login com seu e-mail para receber o codigo OTP de acesso.
</p>
`;

  try {
    await transporter.sendMail({
      from: (await getOtpMailSettings())?.from,
      to: params.email,
      subject: `[HACKER AI] Conta criada :: ${params.appHost}`,
      html: mailWrapper("Conta criada", content),
      text: `HACKER AI :: Conta criada\n\nOla ${params.name},\n\nUma conta foi criada para voce.\n\nE-mail: ${params.email}\nPlano: ${params.planName}\nPapel: ${params.role}\nCriada por: ${params.createdBy}\n\nFaca login com seu e-mail para receber o codigo OTP.`,
    });
    return true;
  } catch (error) {
    console.error("[NEXUS] falha ao enviar e-mail de conta criada:", error);
    return false;
  }
}
