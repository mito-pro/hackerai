"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "attack" | "contained";

const LINES = [
  "intrusao detectada :: origem {ip}",
  "vetor: /admin/login · tentativas de bruteforce",
  "assindo sessoes suspeas...",
  "rotas criticas isoladas (/api/chat, /api/admin)",
  "contra-medida aplicada: rate limit + bloqueio de sessao",
  "varredura de integridade: OK",
  "STATUS: AMEACA CONTIDA",
];

function randomIp() {
  return `${203 + Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 255)}.0.${Math.floor(Math.random() * 255)}`;
}

export default function BreachFX() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const trigger = () => {
      if (phase !== "idle") return;
      const ip = randomIp();
      const resolved = LINES.map((line) => line.replace("{ip}", ip));
      setLines([]);
      setPhase("attack");
      setVisible(true);

      if (reduced) {
        setLines(resolved);
        setPhase("contained");
        return;
      }

      let index = 0;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        index += 1;
        setLines(resolved.slice(0, index));
        if (index >= resolved.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setPhase("contained");
        }
      }, 520);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        trigger();
      }
    };

    window.addEventListener("nexus:breach", trigger);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("nexus:breach", trigger);
      window.removeEventListener("keydown", onKey);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "contained") return;
    const timer = setTimeout(() => setVisible(false), 4200);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!visible) setPhase("idle");
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black/92 p-6"
      role="alertdialog"
      aria-label="Alerta de intrusao simulado"
    >
      <div className="breach-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="breach-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative w-full max-w-2xl space-y-5">
        <p className="breach-tag text-[11px] tracking-[0.3em] uppercase">
          security operations :: alerta
        </p>

        <h2
          className={`breach-title text-center text-3xl font-bold tracking-[0.18em] uppercase sm:text-5xl ${
            phase === "contained" ? "breach-ok" : "breach-bad"
          }`}
        >
          {phase === "contained" ? "ameaca contida" : "sistema comprometido"}
        </h2>

        <div className="rounded-lg border border-red-500/40 bg-black/70 p-4 font-mono text-[12.5px] leading-relaxed">
          {lines.map((line, index) => (
            <p
              key={line}
              className={
                phase === "contained" && index === lines.length - 1
                  ? "text-neon"
                  : "text-red-400"
              }
            >
              <span className="text-red-500/60">root@nexus:~$ </span>
              {line}
            </p>
          ))}
          {phase === "attack" ? (
            <p className="text-red-400 animate-pulse">root@nexus:~$ _</p>
          ) : null}
        </div>

        <div className="h-1 w-full overflow-hidden rounded-full bg-red-900/60">
          <div
            className={`h-full transition-all duration-[3500ms] ${
              phase === "contained" ? "bg-neon w-full" : "bg-red-500 w-2/3"
            }`}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-muted text-[11.5px]">
            {phase === "contained"
              ? "contencao concluida · nenhuma acao necessaria (simulacao)"
              : "isolamento em curso · nao feche a janela"}
          </p>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => setVisible(false)}
            disabled={phase !== "contained"}
          >
            fechar
          </button>
        </div>
      </div>
    </div>
  );
}
