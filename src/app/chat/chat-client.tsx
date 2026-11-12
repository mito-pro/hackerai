"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ModelDef } from "@/lib/model-registry";
import { readJsonSafe } from "@/lib/utils";
import { ChatShell, type ChatSummary, type ChatUsage, type ChatUser } from "@/components/chat/chat-shell";

type MePayload = {
  user: (ChatUser & {
    planId: string;
    capabilities: string[];
    maxContext: number;
    providers: string[];
  }) | null;
  usage: ChatUsage;
  models: ModelDef[];
  missingProviders?: { id: string; label: string }[];
  fallbackActive?: boolean;
  maintenance?: { enabled: boolean; message: string };
};

export default function ChatClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<MePayload | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          router.replace("/login/");
          return;
        }
        const data = await readJsonSafe<MePayload>(response);
        if (!active) return;
        if (!data?.user) {
          router.replace("/login/");
          return;
        }
        if (data.maintenance?.enabled) {
          router.replace("/maintenance/");
          return;
        }
        setPayload(data);

        const chatsResponse = await fetch("/api/chats", { cache: "no-store" });
        if (chatsResponse.ok) {
          const chatsData = await readJsonSafe<{ chats?: ChatSummary[] }>(
            chatsResponse
          );
          if (active && Array.isArray(chatsData?.chats)) {
            setChats(chatsData.chats);
          }
        }
      } catch {
        router.replace("/login/");
      } finally {
        if (active) setReady(true);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready || !payload?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neon text-[12.5px] tracking-[0.2em] uppercase">
          nexus_core :: conectando
        </p>
      </div>
    );
  }

  if (payload.maintenance?.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="panel max-w-lg p-8 text-center">
          <h1 className="text-amber text-xl tracking-[0.18em] uppercase">
            [ manutencao ]
          </h1>
          <p className="text-muted mt-4 text-[13px]">
            {payload.maintenance.message}
          </p>
          <a href="/maintenance/" className="btn btn-xs btn-primary mt-6">
            abrir aviso
          </a>
        </div>
      </div>
    );
  }

  const maxContext = payload.user.maxContext ?? 0;

  return (
    <ChatShell
      user={{
        id: payload.user.id,
        email: payload.user.email,
        name: payload.user.name,
        role: payload.user.role,
        planName: payload.user.planName,
      }}
      usage={payload.usage}
      models={payload.models}
      chats={chats}
      canExport={payload.user.capabilities.includes("export_chat")}
      maxContext={maxContext}
      missingProviders={payload.missingProviders ?? []}
      fallbackActive={payload.fallbackActive ?? false}
    />
  );
}
