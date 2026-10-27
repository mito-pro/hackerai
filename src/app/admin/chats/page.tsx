"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatNumber } from "@/lib/utils";

type AdminChat = {
  id: string;
  userId: string;
  email: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function AdminChatsPage() {
  const [chats, setChats] = useState<AdminChat[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/chats?limit=200", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar.");
        return await response.json();
      })
      .then((data) => setChats(data.chats ?? []))
      .catch(() => setMessage("Falha ao carregar as sessoes."));
  }, []);

  async function remove(id: string) {
    setMessage("");
    const response = await fetch(`/api/chats/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Falha ao remover.");
      return;
    }
    setMessage("conversa removida.");
    setChats((current) => current.filter((chat) => chat.id !== id));
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
          [ conversas ]
        </h1>
        <p className="text-muted text-[12.5px]">
          Historico completo de conversas por operador.
        </p>
      </header>

      {message ? <p className="text-neon text-[12.5px]">{message}</p> : null}

      <div className="panel overflow-x-auto p-4">
        <table>
          <thead>
            <tr>
              <th>titulo</th>
              <th>operador</th>
              <th>modelo</th>
              <th>mensagens</th>
              <th>criada</th>
              <th>atualizada</th>
              <th>acoes</th>
            </tr>
          </thead>
          <tbody>
            {chats.map((chat) => (
              <tr key={chat.id}>
                <td className="text-neon">{chat.title}</td>
                <td className="text-muted">{chat.email}</td>
                <td>{chat.model}</td>
                <td>{formatNumber(chat.messageCount)}</td>
                <td className="text-muted">{formatDateTime(chat.createdAt)}</td>
                <td className="text-muted">{formatDateTime(chat.updatedAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <a
                      className="btn btn-xs"
                      href={`/api/chats/${chat.id}/export?format=md`}
                    >
                      exportar
                    </a>
                    <button
                      type="button"
                      className="btn btn-xs btn-danger"
                      onClick={() => remove(chat.id)}
                    >
                      remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!chats.length ? (
              <tr>
                <td colSpan={7} className="text-muted">
                  nenhuma conversa registrada
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
