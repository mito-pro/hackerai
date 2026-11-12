"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type Model = { id: string; label: string; type: string };

export default function GenerateAudioPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState("nvidia/riva-translate-4b-instruct-v2");
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
          model,
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
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-neon text-3xl tracking-[0.2em] uppercase mb-1">
              [ gerar audio ]
            </h1>
            <p className="text-muted text-[13px]">
              Converta texto em fala com vozes realistas via NVIDIA ou RunAPI.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted border border-line px-2 py-1 rounded">
              nexus_audio_v1
            </span>
          </div>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-lg border border-danger/40 bg-danger/10 text-danger text-[12.5px]">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-6 p-4 rounded-lg border border-neon/40 bg-neon/5 text-neon text-[12.5px]">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-12">
          <div className="sm:col-span-5 lg:col-span-4">
            <section className="panel p-5 mb-6">
              <h2 className="text-neon text-xs tracking-[0.2em] uppercase mb-4">
                configuracoes
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="label text-[12px] mb-2 block">
                    modelo de audio
                  </label>
                  <select
                    className="input w-full"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="nvidia/riva-translate-4b-instruct-v2">
                      NVIDIA · Riva TTS
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">voz</label>
                  <input
                    className="input"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="ex: femina, masculina, criança..."
                  />
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">texto</label>
                  <textarea
                    className="input min-h-[160px]"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escreva o texto que deseja converter em audio..."
                  />
                </div>

                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || !text.trim()}
                  className={`w-full py-4 text-sm tracking-wider uppercase font-bold transition ${
                    loading || !text.trim()
                      ? "bg-[#1a1a24] border border-line text-muted cursor-not-allowed"
                      : "bg-neon text-[#050507] hover:bg-[#00ff88]"
                  }`}
                >
                  {loading ? "gerando audio..." : "gerar audio agora"}
                </button>
              </div>
            </section>
          </div>

          <div className="sm:col-span-7 lg:col-span-8">
            <section className="panel p-6 mb-6 min-h-[400px] flex flex-col">
              <h2 className="text-neon text-xs tracking-[0.2em] uppercase mb-4">
                preview do resultado
              </h2>
              <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] border border-line rounded-lg p-4">
                {!audio ? (
                  <div className="text-center flex flex-col items-center gap-3">
                    <span className="text-muted text-[11px] tracking-[0.2em] uppercase">
                      nenhum resultado ainda
                    </span>
                    <p className="text-muted text-[12px] max-w-xs">
                      digite um texto e clique em gerar audio para ouvir o resultado aqui.
                    </p>
                  </div>
                ) : (
                  <div className="w-full max-w-md">
                    <audio controls className="w-full" src={audio} />
                    <div className="mt-4 flex items-center justify-between">
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
                        baixar audio (.mp3)
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {audio && (
                <div className="mt-4 p-3 rounded-lg bg-[#0a0a0a] border border-line text-[12px] text-muted">
                  <div className="flex justify-between mb-1">
                    <span className="text-neon">modelo:</span>
                    <span>{model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neon">voz:</span>
                    <span>{voice || "padrao"}</span>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
