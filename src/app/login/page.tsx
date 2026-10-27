"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readJsonSafe } from "@/lib/utils";
import { OtpLogin } from "@/components/otp-login";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? readJsonSafe<{ user?: unknown }>(response)
          : Promise.resolve(null)
      )
      .then((data) => {
        if (active && data?.user) router.replace("/chat/");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="panel glow-box p-7">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/emblem-hackerai.png"
              alt="HACKER AI"
              width={132}
              height={132}
              className="size-28 rounded-xl border border-line"
              priority
            />
            <p className="text-neon mt-4 text-2xl tracking-[0.3em]">HACKER_AI</p>
            <p className="text-muted mt-1 text-[11px] tracking-[0.24em] uppercase">
              nexus access :: otp gateway
            </p>
          </div>
          <OtpLogin />
        </div>
        <p className="text-muted mt-4 text-center text-[11px]">
          Sem senha. O codigo expira em 10 minutos e aceita 5 tentativas.
        </p>
      </div>
    </div>
  );
}
