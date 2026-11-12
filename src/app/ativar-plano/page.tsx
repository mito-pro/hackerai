"use client";

import { useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

export default function ActivatePlanPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activated, setActivated] = useState(false);
  const [planName, setPlanName] = useState("");

  useEffect(() => {
    // Verifica se ja tem um pagamento/upgrade pendente para este usuario
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await readJsonSafe<{ user?: { planId: string; planName: string } }>(res);
      if (data?.user) {
        setPlanName(data.user.planName);
      }
    } catch {
      // ignore
    }
  }

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setError("Informe o codigo de ativacao.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/activate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await readJsonSafe<{ ok?: boolean; plan?: string; planName?: string; message?: string; error?: string }>(res);
      if (!res.ok) {
        setError(data?.error || data?.message || "Falha ao ativar plano.");
        return;
      }
      setActivated(true);
      setPlanName(data?.planName || "novo plano");
      setMessage(data?.message || "Plano ativado com sucesso.");
    } catch {
      setError("Falha de rede ao ativar plano.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-4 sm:p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="panel p-8 mb-6 text-center">
          <div className="mb-4">
            <span className="text-neon text-3xl font-mono">🔑</span>
          </div>
          <h1 className="text-neon text-2xl tracking-[0.2em] uppercase mb-2">
            [ ativar plano ]
          </h1>
          <p className="text-muted text-[13px] mb-6">
            Digite o codigo de ativacao enviado para o seu e-mail pelo administrador.
          </p>

          {activated ? (
            <div className="p-4 rounded-lg border border-neon/40 bg-neon/5 text-neon text-[12.5px] mb-6">
              <p className="font-bold">{message}</p>
              <p className="text-[11px] mt-2 text-neon/80">
                Plano agora ativo: {planName}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mb-6 p-3 text-danger border border-danger/20 bg-danger/5 rounded text-[12.5px]">
              {error}
            </div>
          ) : null}

          {!activated && (
            <form onSubmit={activate} className="space-y-3">
              <div>
                <label className="label text-[12px] block mb-2">
                  codigo de ativacao
                </label>
                <input
                  className="input w-full text-center font-mono text-neon"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ex: 123456"
                  maxLength={10}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className={`w-full py-4 text-sm tracking-wider uppercase font-bold transition ${
                  loading || !code.trim()
                    ? "bg-[#1a1a24] border border-line text-muted cursor-not-allowed"
                    : "bg-neon text-[#050507] hover:bg-[#00ff88]"
                }`}
              >
                {loading ? "ativando..." : "ativar plano"}
              </button>
            </form>
          )}

          <p className="mt-4 text-[11px] text-muted">
            Nao recebeu o codigo? Solicite o pagamento/upgrade novamente ou
            entre em contato com o administrador em Admin {'>'} Provedores.
          </p>
        </div>
      </div>
    </div>
  );
}
