"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

const NAV = [
  { href: "/admin/", label: "dashboard" },
  { href: "/admin/users/", label: "usuarios" },
  { href: "/admin/plans/", label: "planos" },
  { href: "/admin/usage/", label: "tokens" },
  { href: "/admin/providers/", label: "provedores" },
  { href: "/admin/omega/", label: "omega" },
  { href: "/admin/chats/", label: "conversas" },
  { href: "/admin/sessions/", label: "sessoes" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? readJsonSafe<{ user?: { email?: string; role?: string } }>(response)
          : Promise.resolve(null)
      )
      .then((data) => {
        if (!active) return;
        if (!data?.user) {
          router.replace("/login/");
          return;
        }
        if (data.user.role !== "admin") {
          router.replace("/chat/");
          return;
        }
        setEmail(data.user.email ?? "");
        setAllowed(true);
      })
      .catch(() => router.replace("/login/"));

    return () => {
      active = false;
    };
  }, [router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neon text-[12.5px] tracking-[0.2em] uppercase">
          nexus_core :: verificando permissao
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-2.5">
          <Link href="/admin/" className="flex items-center gap-2">
            <Image
              src="/emblem-hackerai.png"
              alt="HACKER AI"
              width={30}
              height={30}
              className="size-[30px] rounded-md"
            />
            <span className="text-xs tracking-[0.28em] text-neon">
              HACKER_AI<span className="text-text"> :: ADMIN</span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="btn btn-xs">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted hidden text-[11.5px] sm:inline">
              {email}
            </span>
            <Link href="/chat/" className="btn btn-xs btn-primary">
              terminal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
