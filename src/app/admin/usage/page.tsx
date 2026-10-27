"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatNumber } from "@/lib/utils";

type Log = {
  id: string;
  userId: string;
  email: string;
  chatId: string | null;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  createdAt: string;
};

export default function AdminUsagePage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [totals, setTotals] = useState({ tokens: 0, requests: 0 });
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/usage?limit=300", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar o consumo.");
        return await response.json();
      })
      .then((data) => {
        setLogs(data.logs ?? []);
        setTotals(data.totals ?? { tokens: 0, requests: 0 });
      })
      .catch(() => setLogs([]));
  }, []);

  const filtered = logs.filter((log) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      log.email.toLowerCase().includes(term) ||
      log.model.toLowerCase().includes(term) ||
      log.provider.toLowerCase().includes(term)
    );
  });

  function exportCsv() {
    const header = [
      "id",
      "email",
      "modelo",
      "provedor",
      "entrada",
      "saida",
      "total",
      "data",
    ];
    const rows = filtered.map((log) =>
      [
        log.id,
        log.email,
        log.model,
        log.provider,
        log.inputTokens,
        log.outputTokens,
        log.totalTokens,
        log.createdAt,
      ].join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexus-usage-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ tokens ]
          </h1>
          <p className="text-muted text-[12.5px]">
            {formatNumber(totals.requests)} requisicoes ::{" "}
            {formatNumber(totals.tokens)} tokens contabilizados
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input w-full max-w-xs"
            placeholder="filtrar por e-mail, modelo ou provedor..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="btn" onClick={exportCsv}>
            exportar csv
          </button>
        </div>
      </header>

      <div className="panel overflow-x-auto p-4">
        <table>
          <thead>
            <tr>
              <th>data</th>
              <th>operador</th>
              <th>modelo</th>
              <th>provedor</th>
              <th>entrada</th>
              <th>saida</th>
              <th>total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td className="text-muted">{formatDateTime(log.createdAt)}</td>
                <td className="text-neon">{log.email}</td>
                <td>{log.model}</td>
                <td className="text-muted">{log.provider}</td>
                <td>{formatNumber(log.inputTokens)}</td>
                <td>{formatNumber(log.outputTokens)}</td>
                <td className="text-neon">{formatNumber(log.totalTokens)}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={7} className="text-muted">
                  nenhum registro de consumo
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
