"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Markdown } from "./markdown";
import type { ModelDef } from "@/lib/model-registry";
import { generateId } from "@/lib/utils";

export type ChatUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  planName: string;
};

export type ChatUsage = {
  tokensUsed: number;
  tokenLimit: number;
  messagesToday: number;
  dailyLimit: number;
  percent: number;
};

export type ChatSummary = {
  id: string;
  title: string;
  model: string;
  updated_at: string;
};

const SUGGESTIONS = [
  "Explique o que e um token de LLM em 3 linhas",
  "Escreva um script bash que lista portas abertas",
  "Como configuro a chave gratuita da Groq aqui?",
  "Monte um plano de estudo de seguranca da informacao",
];

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("");
}

export function ChatShell({
  user,
  usage: initialUsage,
  models,
  chats,
  canExport = false,
  maxContext = 0,
}: {
  user: ChatUser;
  usage: ChatUsage;
  models: ModelDef[];
  chats: ChatSummary[];
  canExport?: boolean;
  maxContext?: number;
}) {
  const router = useRouter();
  const [model, setModel] = useState(
    models.find((item) => item.id === "nexus-local")?.id ?? models[0]?.id ?? "nexus-local"
  );
  const [usage, setUsage] = useState(initialUsage);
  const [chatId, setChatId] = useState<string>(() => generateId("chat"));
  const [history, setHistory] = useState<UIMessage[]>([]);
  const [chatList, setChatList] = useState(chats);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function refreshUsage() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.usage) setUsage(data.usage);
    } catch {
      /* offline */
    }
  }

  async function refreshChats() {
    try {
      const response = await fetch("/api/chats", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.chats)) setChatList(data.chats);
    } catch {
      /* offline */
    }
  }

  async function openChat(id: string) {
    try {
      const response = await fetch(`/api/chats/${id}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setHistory((data.messages ?? []) as UIMessage[]);
      setChatId(id);
      setSidebarOpen(false);
    } catch {
      /* offline */
    }
  }

  function startNewChat() {
    setHistory([]);
    setChatId(generateId("chat"));
    setSidebarOpen(false);
  }

  async function removeChat(id: string) {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    setChatList((current) => current.filter((chat) => chat.id !== id));
    if (id === chatId) startNewChat();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login/");
  }

  const selectedModel = models.find((item) => item.id === model) ?? models[0];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            className="btn btn-xs lg:hidden"
            onClick={() => setSidebarOpen((value) => !value)}
          >
            menu
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/emblem-hackerai.png"
              alt="HACKER AI"
              width={34}
              height={34}
              className="size-[34px] rounded-md"
            />
            <span className="text-xs tracking-[0.28em] text-neon">HACKER_AI</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <select
              className="input w-auto py-1.5 text-[12px]"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {user.role === "admin" ? (
              <Link href="/admin/" className="btn btn-xs hidden sm:inline-flex">
                Admin
              </Link>
            ) : null}
            <button type="button" onClick={logout} className="btn btn-xs">
              sair
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? "block" : "hidden"
          } panel-flat fixed inset-x-0 top-[53px] z-10 max-h-[calc(100vh-53px)] overflow-y-auto p-4 lg:static lg:block lg:max-h-none lg:w-72 lg:shrink-0 lg:rounded-none lg:border-y-0 lg:border-l-0`}
        >
          <button type="button" onClick={startNewChat} className="btn btn-primary w-full">
            + nova sessao
          </button>

          <div className="panel-flat mt-4 p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted text-[11px] tracking-[0.16em] uppercase">
                consumo
              </span>
              <span className="text-neon text-[11px]">
                {usage.percent.toFixed(1)}%
              </span>
            </div>
            <div
              className={`meter mt-2 ${
                usage.percent > 90 ? "danger" : usage.percent > 70 ? "warn" : ""
              }`}
            >
              <span style={{ width: `${Math.min(100, usage.percent)}%` }} />
            </div>
            <p className="text-muted mt-2 text-[11.5px]">
              {usage.tokensUsed.toLocaleString("pt-BR")} /{" "}
              {usage.tokenLimit.toLocaleString("pt-BR")} tokens
            </p>
            <p className="text-muted text-[11.5px]">
              {usage.messagesToday}/{usage.dailyLimit} mensagens hoje
            </p>
            <p className="text-muted text-[11.5px]">
              contexto {maxContext.toLocaleString("pt-BR")} tokens por
              requisicao
            </p>
            <p className="text-neon mt-2 text-[11px] tracking-[0.14em] uppercase">
              plano {user.planName}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-muted text-[11px] tracking-[0.16em] uppercase">
              historico
            </p>
            <ul className="mt-2 space-y-1">
              {chatList.length === 0 ? (
                <li className="text-muted text-[12px]">nenhuma sessao salva</li>
              ) : null}
              {chatList.map((chat) => (
                <li key={chat.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openChat(chat.id)}
                    className={`flex-1 truncate rounded-md border px-2 py-1.5 text-left text-[12px] ${
                      chat.id === chatId
                        ? "border-neon/40 text-neon"
                        : "border-transparent text-muted hover:border-line hover:text-text"
                    }`}
                  >
                    {chat.title}
                  </button>
                  {canExport ? (
                    <a
                      className="text-muted px-1 text-[11px] opacity-0 transition group-hover:opacity-100 hover:text-neon"
                      href={`/api/chats/${chat.id}/export?format=md`}
                      title="Exportar conversa (.md)"
                    >
                      down
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeChat(chat.id)}
                    className="text-muted px-1 text-[11px] opacity-0 transition group-hover:opacity-100 hover:text-danger"
                    aria-label="Excluir sessao"
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel-flat mt-5 p-3">
            <p className="text-muted text-[11px] tracking-[0.16em] uppercase">
              operador
            </p>
            <p className="text-neon mt-1 truncate text-[12.5px]">{user.email}</p>
            <p className="text-muted text-[11.5px]">
              {user.name} :: {user.role}
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <ChatPanel
            key={chatId}
            chatId={chatId}
            model={model}
            initialMessages={history}
            modelLabel={selectedModel?.label ?? model}
            onUsage={refreshUsage}
            onComplete={refreshChats}
          />
        </main>
      </div>
    </div>
  );
}

function ChatPanel({
  chatId,
  model,
  initialMessages,
  modelLabel,
  onUsage,
  onComplete,
}: {
  chatId: string;
  model: string;
  initialMessages: UIMessage[];
  modelLabel: string;
  onUsage: () => void;
  onComplete: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [localError, setLocalError] = useState("");

  const { messages, sendMessage, status, error, stop } = useChat<UIMessage>({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => {
      onUsage();
      onComplete();
    },
  });

  const busy = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setLocalError("");
    try {
      await sendMessage({ text }, { body: { model } });
    } catch (submitError) {
      setLocalError(
        submitError instanceof Error ? submitError.message : "Falha ao enviar."
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="panel p-6">
              <p className="text-neon text-sm tracking-[0.16em] uppercase">
                nexus_core :: pronto
              </p>
              <p className="text-muted mt-2 text-[13px]">
                Conectado em{" "}
                <span className="text-neon">{modelLabel}</span>. Envie uma
                instrucao ou use um dos atalhos abaixo.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="panel-flat px-3 py-2 text-left text-[12.5px] text-muted hover:text-neon"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-5">
            {messages.map((message) => {
              const text = messageText(message);
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={isUser ? "flex justify-end" : "w-full"}
                >
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] rounded-xl border border-neon/30 bg-neon/5 px-4 py-3"
                        : "panel w-full px-4 py-3"
                    }
                  >
                    <p
                      className={`mb-2 text-[10.5px] tracking-[0.2em] uppercase ${
                        isUser ? "text-neon" : "text-muted"
                      }`}
                    >
                      {isUser ? "operador" : "nexus"}
                    </p>
                    {isUser ? (
                      <p className="text-[13.5px] whitespace-pre-wrap">{text}</p>
                    ) : text ? (
                      <Markdown>{text}</Markdown>
                    ) : (
                      <p className="text-neon terminal-caret text-[13px]">
                        processando
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {localError || error ? (
            <p className="text-danger mt-4 text-[12.5px]">
              {localError || error?.message}
            </p>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-line bg-ink/80 px-4 py-3 backdrop-blur">
        <form
          onSubmit={submit}
          className="mx-auto flex w-full max-w-3xl items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            rows={2}
            placeholder="digite a instrucao... (enter envia, shift+enter quebra linha)"
            className="input resize-none"
          />
          {busy ? (
            <button type="button" onClick={() => stop()} className="btn btn-danger">
              stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="btn btn-primary">
              enviar
            </button>
          )}
        </form>
        <p className="text-muted mx-auto mt-2 w-full max-w-3xl text-[11px]">
          tokens e limites sao contabilizados por requisicao :: modelo{" "}
          {modelLabel}
        </p>
      </div>
    </div>
  );
}
