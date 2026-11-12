"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

const NAV_GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "operacao",
    items: [
      { href: "/admin/", label: "dashboard" },
      { href: "/admin/users/", label: "usuarios" },
      { href: "/admin/chats/", label: "conversas" },
      { href: "/admin/sessions/", label: "sessoes" },
    ],
  },
  {
    title: "planos e modelos",
    items: [
      { href: "/admin/plans/", label: "planos" },
      { href: "/admin/usage/", label: "tokens" },
      { href: "/admin/providers/", label: "provedores" },
      { href: "/admin/models-test/", label: "testar modelos" },
    ],
  },
  {
    title: "sistema",
    items: [
      { href: "/admin/omega/", label: "omega" },
      { href: "/admin/audit/", label: "auditoria" },
      { href: "/admin/maintenance/", label: "manutencao" },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neon text-[12.5px] tracking-[0.2em] uppercase">
          nexus_core :: verificando permissao
        </p>
      </div>
    );
  }

  function isActive(href: string) {
    if (href === "/admin/") return pathname === "/admin/";
    return pathname.startsWith(href);
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link href="/admin/" className="flex items-center gap-2">
        <Image
          src="/emblem-hackerai.png"
          alt="HACKER AI"
          width={34}
          height={34}
          className="size-[34px] rounded-md"
        />
        <span className="text-xs tracking-[0.24em] text-neon">
          HACKER_AI<span className="text-text"> :: ADMIN</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-muted mb-2 text-[10px] tracking-[0.22em] uppercase">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] transition ${
                        active
                          ? "border-neon/45 bg-neon/10 text-neon"
                          : "border-transparent text-muted hover:border-line hover:text-text"
                      }`}
                    >
                      <span
                        className={`inline-block size-1.5 rounded-full ${
                          active ? "bg-neon" : "bg-line"
                        }`}
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="panel-flat space-y-2 p-3">
        <p className="text-muted text-[10.5px] tracking-[0.16em] uppercase">
          operador
        </p>
        <p className="text-neon truncate text-[12.5px]">{email}</p>
        <div className="flex gap-2">
          <Link href="/chat/" className="btn btn-xs btn-primary flex-1">
            terminal
          </Link>
          <button
            type="button"
            className="btn btn-xs"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login/");
            }}
          >
            sair
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="panel-flat sticky top-0 hidden h-dvh border-y-0 border-l-0 lg:block">
        {sidebar}
      </aside>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`panel-flat fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-y-0 border-l-0 transition-transform duration-200 lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
          <div className="flex items-center gap-3 px-5 py-2.5">
            <button
              type="button"
              className="btn btn-xs lg:hidden"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label="Abrir menu"
            >
              menu
            </button>
            <p className="text-muted text-[11.5px] tracking-[0.18em] uppercase">
              painel de controle :: nexus core
            </p>
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
    </div>
  );
}
