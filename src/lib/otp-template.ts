export type OtpTemplateInput = {
  code: string;
  ttlMinutes: number;
  appHost: string;
  brand?: string;
  logoCid?: string;
};

export type OtpTemplate = {
  subject: string;
  text: string;
  html: string;
};

const BRAND = "HACKER AI";

function escapeHtml(value: string) {
  const amp = String.fromCharCode(38);
  return value
    .replace(/&/g, `${amp}amp;`)
    .replace(/</g, `${amp}lt;`)
    .replace(/>/g, `${amp}gt;`)
    .replace(/"/g, `${amp}quot;`)
    .replace(/'/g, `${amp}#39;`);
}

function line(char = "━", length = 64) {
  return char.repeat(length);
}

export function buildOtpTemplate({
  code,
  ttlMinutes,
  appHost,
  brand = BRAND,
  logoCid,
}: OtpTemplateInput): OtpTemplate {
  const subject = `🔑 Sua chave de autenticação — ${appHost}`;
  const safeHost = escapeHtml(appHost);
  const safeCode = escapeHtml(code);
  const safeBrand = escapeHtml(brand);
  const preheader = `Seu código de acesso é ${code}. Ele expira em ${ttlMinutes} minutos.`;

  const brandBlock = `<p style="margin:0;font-size:17px;line-height:1.3;letter-spacing:0.26em;color:#00ff9c;text-transform:uppercase;">${safeBrand}</p>
<p style="margin:8px 0 0;font-size:11px;line-height:1.4;letter-spacing:0.22em;color:#7d8f9b;text-transform:uppercase;">// access protocol</p>`;

  const logoBlock = logoCid
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="78" valign="middle" style="width:78px;">
<img src="cid:${escapeHtml(logoCid)}" alt="${safeBrand}" width="78" height="78" style="display:block;width:78px;height:78px;border:0;border-radius:10px;outline:none;text-decoration:none;">
</td>
<td valign="middle" style="padding-left:18px;">
${brandBlock}
</td>
</tr>
</table>`
    : brandBlock;

  const text = [
    `${brand} // ACCESS PROTOCOL`,
    line(),
    `ASSUNTO: 🔑 SUA CHAVE DE AUTENTICAÇÃO — ${appHost}`,
    line(),
    "",
    "  [ SYSTEM MESSAGE ] — AUTENTICAÇÃO SOLICITADA",
    "",
    "  Olá, operador. 👾",
    "",
    `  Uma solicitação de autenticação foi detectada para a sua conta no ${appHost}.`,
    "",
    "  🔐 CÓDIGO DE ACESSO TEMPORÁRIO",
    "",
    `      ${code}`,
    "",
    "  ⚠️  STATUS: AGUARDANDO AUTENTICAÇÃO",
    "",
    `  ⏳  Este código possui validade limitada e expira em ${ttlMinutes} minutos.`,
    "      Insira-o no campo de verificação antes que a sessão expire.",
    "",
    line(),
    "  🛡️  PROTOCOLO DE SEGURANÇA",
    line(),
    "  •  Se você iniciou esta solicitação, prossiga com a autenticação.",
    "  •  Caso contrário, ignore esta mensagem: sem o código de acesso,",
    "     terceiros não poderão concluir esta etapa de verificação.",
    "  •  Nunca compartilhe este código nem permita que outra pessoa o use.",
    "",
    line(),
    `  ${brand} // SECURE CONNECTION`,
    "  STATUS DO SISTEMA: PROTEGIDO 🔒",
    line(),
    "",
    "  Esta é uma mensagem automática. Não responda a este e-mail.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<title>${safeBrand} :: código de acesso</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#04070a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    preheader
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#04070a;padding:28px 12px;">
<tr>
<td align="center" style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:#0a1016;border:1px solid #17262f;border-radius:14px;font-family:'JetBrains Mono','Fira Code','Cascadia Code',Consolas,'Courier New',monospace;overflow:hidden;">

<tr>
<td style="padding:22px 28px;border-bottom:1px solid #17262f;background-color:#070c11;">
${logoBlock}
</td>
</tr>

<tr>
<td style="padding:16px 28px;border-bottom:1px solid #17262f;">
<p style="margin:0;font-size:11px;line-height:1.5;letter-spacing:0.16em;color:#7d8f9b;text-transform:uppercase;">Assunto</p>
<p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#d7e3ea;">🔑 Sua chave de autenticação — <span style="color:#00ff9c;">${safeHost}</span></p>
</td>
</tr>

<tr>
<td style="padding:26px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.5;letter-spacing:0.14em;color:#00ff9c;text-transform:uppercase;">[ system message ] — autenticação solicitada</p>
<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#d7e3ea;">Olá, operador. 👾</p>
<p style="margin:10px 0 0;font-size:13.5px;line-height:1.75;color:#9fb1bd;">
Uma solicitação de autenticação foi detectada para a sua conta no
<span style="color:#00ff9c;">${safeHost}</span>.
</p>
</td>
</tr>

<tr>
<td style="padding:24px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#05090d;border:1px solid #1f3b31;border-radius:12px;">
<tr>
<td align="center" style="padding:22px 20px 24px;">
<p style="margin:0;font-size:11px;line-height:1.5;letter-spacing:0.18em;color:#7d8f9b;text-transform:uppercase;">🔐 código de acesso temporário</p>
<p style="margin:16px 0 0;font-size:34px;line-height:1.2;letter-spacing:0.34em;color:#00ff9c;text-shadow:0 0 18px rgba(0,255,156,0.35);">${safeCode}</p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:20px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.5;letter-spacing:0.14em;color:#ffb347;text-transform:uppercase;">⚠️ status: aguardando autenticação</p>
<p style="margin:10px 0 0;font-size:13px;line-height:1.75;color:#9fb1bd;">
⏳ Este código possui validade limitada e expira em <span style="color:#d7e3ea;">${ttlMinutes} minutos</span>. Insira-o no campo de verificação antes que a sessão expire.
</p>
</td>
</tr>

<tr>
<td style="padding:24px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#070c11;border:1px solid #17262f;border-radius:12px;">
<tr>
<td style="padding:20px 22px;">
<p style="margin:0;font-size:12px;line-height:1.5;letter-spacing:0.14em;color:#00ff9c;text-transform:uppercase;">🛡️ protocolo de segurança</p>
<p style="margin:14px 0 0;font-size:13px;line-height:1.8;color:#9fb1bd;">
Se você iniciou esta solicitação, prossiga com a autenticação.<br>
Caso contrário, ignore esta mensagem: sem o código de acesso, terceiros não poderão concluir esta etapa de verificação.<br>
Nunca compartilhe este código nem permita que outra pessoa o use.
</p>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="padding:26px 28px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #17262f;">
<tr>
<td style="padding-top:18px;">
<p style="margin:0;font-size:11px;line-height:1.5;letter-spacing:0.2em;color:#00ff9c;text-transform:uppercase;">${safeBrand} // secure connection</p>
<p style="margin:6px 0 0;font-size:11px;line-height:1.5;letter-spacing:0.16em;color:#7d8f9b;text-transform:uppercase;">status do sistema: protegido 🔒</p>
</td>
</tr>
</table>
<p style="margin:20px 0 0;font-size:11px;line-height:1.7;color:#5f7079;">
Esta é uma mensagem automática. Não responda a este e-mail.
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
