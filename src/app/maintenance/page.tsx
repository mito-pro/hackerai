"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

export default function MaintenancePage() {
  const [message, setMessage] = useState(
    "Sistema em manutencao. Tente novamente em alguns minutos."
  );
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/maintenance", { cache: "no-store" });
        const data = await readJsonSafe<{ enabled?: boolean; message?: string }>(
          response
        );
        if (!active) return;
        if (typeof data?.enabled === "boolean") setEnabled(data.enabled);
        if (data?.message) setMessage(data.message);
      } catch {
        /* offline */
      } finally {
        if (active) setReady(true);
      }
    }

    load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="panel w-full max-w-lg p-8 text-center">
        <div className="flex justify-center">
          <Image
            src="/emblem-hackerai.png"
            alt="HACKER AI"
            width={64}
            height={64}
            className="size-16 rounded-lg"
          />
        </div>

        <p className="text-neon mt-5 text-xs tracking-[0.3em] uppercase">
          HACKER_AI NEXUS
        </p>

        <h1
          className={`mt-4 text-xl tracking-[0.16em] uppercase ${
            enabled ? "text-amber" : "text-neon"
          }`}
        >
          {enabled ? "[ manutencao ]" : "[ online ]"}
        </h1>

        <p className="text-muted mt-4 text-[13px]">
          {enabled
            ? message
            : "A manutencao terminou. O sistema esta disponivel novamente."}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {enabled ? (
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => window.location.reload()}
            >
              recarregar
            </button>
          ) : (
            <Link href="/chat/" className="btn btn-xs btn-primary">
              ir para o chat
            </Link>
          )}
          <Link href="/login/" className="btn btn-xs">
            entrar
          </Link>
        </div>

        <p className="text-muted mt-6 text-[11px]">
          {ready
            ? "esta pagina se atualiza sozinha a cada 15 segundos"
            : "verificando status do sistema..."}
        </p>
      </div>
    </div>
  );
}
