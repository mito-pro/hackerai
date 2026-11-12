"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readJsonSafe } from "@/lib/utils";
import { OtpLogin } from "@/components/otp-login";

export default function LoginClient() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? readJsonSafe<{ user?: unknown; maintenance?: { enabled?: boolean } }>(
              response
            )
          : Promise.resolve(null)
      )
      .then((data) => {
        if (!active) return;
        if (data?.maintenance?.enabled) {
          router.replace("/maintenance/");
          return;
        }
        if (data?.user) router.replace("/chat/");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 sm:px-5 py-6 sm:py-12">
      <div className="w-full max-w-md sm:max-w-lg">
        <div className="panel glow-box p-5 sm:p-7">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/emblem-hackerai.png"
              alt="HACKER AI"
              width={120}
              height={120}
              className="size-24 sm:size-28 rounded-xl border border-line"
              priority
            />
            <p className="text-neon mt-3 sm:mt-4 text-xl sm:text-2xl tracking-[0.3em]">HACKER_AI</p>
            <p className="text-muted mt-1 text-[11px] sm:text-[12px] tracking-[0.24em] uppercase">
              nexus access :: otp gateway
            </p>
          </div>
          <OtpLogin />
        </div>
        <p className="text-muted mt-4 text-center text-[11px] sm:text-[12px]">
          Sem senha. O codigo expira em 10 minutos e aceita 5 tentativas.
        </p>
      </div>
    </div>
  );
}
