"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "code";

export function OtpLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(event: React.SyntheticEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Nao foi possivel enviar o codigo.");
        if (typeof data.retryAfter === "number") setCooldown(data.retryAfter);
        return;
      }
      setStep("code");
      setCooldown(typeof data.retryAfter === "number" ? data.retryAfter : 45);
      if (data.devCode) {
        setDevCode(data.devCode);
        setInfo(
          "SMTP nao configurado: o codigo de teste aparece abaixo (modo dev)."
        );
      } else if (data.deliveryFallback) {
        setInfo(
          "Sem SMTP configurado: o codigo foi gerado e registrado nos logs do servidor. Consulte os logs (Vercel > Logs) e informe o codigo abaixo."
        );
      } else {
        setInfo(
          "Codigo enviado para o seu e-mail. Confira a caixa de entrada e a pasta de spam."
        );
      }
    } catch {
      setError("Falha de rede ao solicitar o codigo.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: React.SyntheticEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Codigo invalido.");
        return;
      }
      router.push("/chat/");
    } catch {
      setError("Falha de rede ao validar o codigo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              E-mail corporativo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="operador@dominio.com"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? "Enviando..." : "Solicitar codigo OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="panel-flat px-3 py-2">
            <p className="text-muted text-[11px] tracking-[0.14em] uppercase">
              codigo enviado para
            </p>
            <p className="text-neon text-sm break-all">{email}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-muted text-[11px] tracking-[0.14em] uppercase">
              [ system message ] — autenticacao solicitada
            </p>
            <span className="badge badge-amber shrink-0">
              aguardando autenticacao
            </span>
          </div>

          {devCode ? (
            <div className="glow-box rounded-lg border border-neon/40 bg-neon/5 p-3 text-center">
              <p className="text-muted text-[11px] tracking-[0.14em] uppercase">
                codigo de teste (modo dev)
              </p>
              <p className="text-neon text-2xl tracking-[0.4em]">{devCode}</p>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="code">
              Codigo de 6 digitos
            </label>
            <input
              id="code"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="000000"
              className="input text-center text-lg tracking-[0.5em]"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </div>

          {error ? <p className="text-danger text-[12.5px]">{error}</p> : null}
          {info ? <p className="text-neon text-[12.5px]">{info}</p> : null}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? "Validando..." : "Entrar no terminal"}
          </button>

          <div className="flex items-center justify-between text-[12px]">
            <button
              type="button"
              className="text-muted hover:text-neon"
              onClick={() => {
                setStep("email");
                setCode("");
                setDevCode("");
                setInfo("");
              }}
            >
              &larr; trocar e-mail
            </button>
            <button
              type="button"
              disabled={cooldown > 0}
              className="text-muted hover:text-neon disabled:opacity-40"
              onClick={requestCode}
            >
              {cooldown > 0 ? `reenviar em ${cooldown}s` : "reenviar codigo"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
