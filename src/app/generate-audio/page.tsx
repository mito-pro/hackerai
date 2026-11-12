"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type Model = { id: string; label: string; type: string };

export default function GenerateAudioPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState("");
  const [audio, setAudio] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/models", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return [];
        const d = await readJsonSafe<{ models?: Model[] }>(r);
        return d?.models ?? [];
      })
      .then((m) => setModels(m.filter((x) => x.type === "audio")))
      .catch(() => undefined);
  }, []);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    aborter.current?.abort();
    const ctrl = new AbortController();
    aborter.current = ctrl;
    setLoading(true);
    setError("");
    setMessage("");
    setAudio(null);
    try {
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: model || "nvidia/riva-translate-4b-instruct-v2",
          text: text.trim(),
          voice: voice || undefined,
        }),
      });
      const data = await readJsonSafe<{ ok?: boolean; audio?: string; mime?: string; model?: string; error?: string }>(res);
      if (!res.ok) {
        setError(data?.error || "Falha ao gerar audio.");
        return;
      }
      setAudio(data?.audio ?? null);
      setMessage("Audio gerado com sucesso.");
    } catch {
      setError("Falha de rede ao gerar audio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-neon text-2xl tracking-[0.2em] uppercase mb-6">
          [ gerar audio ]
        </h1>

        {error ? (
          <p className="mb-4 p-3 text-danger border border-danger/20 bg-danger/5 rounded text-[12.5px]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 p-3 text-neon border border-neon/20 bg-neon/5 rounded text-[12.5px]">
            {message}
          </p>
        ) : null}

        <form onSubmit={generate} className="grid gap-4 sm:grid-cols-3 mb-6 panel p-5">
          <div>
            <label className="label text-[12px]">modelo</label>
            <select
              className="input w-full"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">padrao (NVIDIA)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label text-[12px]">texto</label>
            <textarea
              className="input min-h-[100px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="digite o texto para ser convertido em audio..."
            />
          </div>
          <div>
            <label className="label text-[12px]">voz</label>
            <input
              className="input"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <div className="col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="btn btn-primary py-3 text-sm tracking-wider uppercase"
            >
              {loading ? "gerando..." : "gerar audio"}
            </button>
          </div>
        </form>

        {audio && (
          <section className="panel p-5 mb-6">
            <h2 className="text-neon text-sm tracking-[0.18em] uppercase mb-3">
              resultado
            </h2>
            <div className="flex flex-col gap-3 bg-[#0a0a0a] border border-line rounded-lg p-3">
              <audio controls className="w-full" src={audio} />
              <div className="flex items-center justify-between text-[12px] text-muted">
                <span>modelo: {model || "padrao"}</span>
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = audio;
                    a.download = `nexus-audio-${Date.now()}.mp3`;
                    a.click();
                  }}
                  className="btn btn-xs btn-neon"
                >
                  baixar audio
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
