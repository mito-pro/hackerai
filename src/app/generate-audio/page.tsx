"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";
import DecodeText from "@/components/fx/decode-text";

type Model = { id: string; label: string; type: string; provider?: string };

const DEFAULT_MODEL = "google-tts/pt";
const MAX_CHARS = 4000;
const VOICE_CHIPS = ["", "nova", "alloy", "echo", "fable", "Brian", "Emma"];

export default function GenerateAudioPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [audio, setAudio] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const aborter = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/models?type=audio", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return [];
        const d = await readJsonSafe<{ models?: Model[] }>(r);
        return d?.models ?? [];
      })
      .then((m) => {
        setModels(m);
        setModel((current) =>
          m.some((item) => item.id === current)
            ? current
            : m[0]?.id ?? DEFAULT_MODEL
        );
      })
      .catch(() => undefined);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 500);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

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
    startTimer();
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
      const data = await readJsonSafe<{
        ok?: boolean;
        audio?: string;
        mime?: string;
        model?: string;
        provider?: string;
        usedFallback?: boolean;
        message?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(data?.message || data?.error || "Falha ao gerar audio.");
        return;
      }
      setAudio(data?.audio ?? null);
      setMessage(
        data?.usedFallback
          ? `Audio gerado via ${data.provider} (provedor principal indisponivel).`
          : "Audio gerado com sucesso."
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Falha de rede ao gerar audio.");
    } finally {
      stopTimer();
      setLoading(false);
    }
  }

  const options = models.map((m) => ({ value: m.id, label: m.label }));
  if (!options.some((o) => o.value === model)) {
    options.unshift({ value: model, label: model });
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 fade-up">
          <div>
            <h1 className="text-neon text-3xl tracking-[0.2em] uppercase mb-1">
              <DecodeText text="[ gerar audio ]" />
            </h1>
            <p className="text-muted text-[13px]">
              Converta texto em fala com vozes realistas, sem chave de API.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted border border-line px-2 py-1 rounded">
              nexus_audio_v2
            </span>
          </div>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-lg border border-danger/40 bg-danger/10 text-danger text-[12.5px] fade-up">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mb-6 p-4 rounded-lg border border-neon/40 bg-neon/5 text-neon text-[12.5px] fade-up">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-12">
          <div className="sm:col-span-5 lg:col-span-4">
            <section className="panel p-5 mb-6 fade-up fade-up-1">
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
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">voz</label>
                  <input
                    className="input"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="ex: nova, alloy, brian..."
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {VOICE_CHIPS.map((chip) => (
                      <button
                        key={chip || "padrao"}
                        type="button"
                        onClick={() => setVoice(chip)}
                        className={`btn btn-xs ${voice === chip ? "btn-primary" : ""}`}
                      >
                        {chip || "padrao"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">
                    texto
                    <span className={`float-right ${text.length > MAX_CHARS ? "text-danger" : "text-muted"} normal-case tracking-normal`}>
                      {text.length}/{MAX_CHARS}
                    </span>
                  </label>
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
                  disabled={loading || !text.trim() || text.length > MAX_CHARS}
                  className={`w-full py-4 text-sm tracking-wider uppercase font-bold transition ${
                    loading || !text.trim() || text.length > MAX_CHARS
                      ? "bg-[#1a1a24] border border-line text-muted cursor-not-allowed"
                      : "bg-neon text-[#050507] hover:bg-[#00ff88]"
                  }`}
                >
                  {loading ? `gerando... ${elapsed}s` : "gerar audio agora"}
                </button>
              </div>
            </section>
          </div>

          <div className="sm:col-span-7 lg:col-span-8">
            <section className="panel p-6 mb-6 min-h-[400px] flex flex-col fade-up fade-up-2">
              <h2 className="text-neon text-xs tracking-[0.2em] uppercase mb-4">
                preview do resultado
              </h2>
              <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] border border-line rounded-lg p-4">
                {loading ? (
                  <div className="text-center flex flex-col items-center gap-3">
                    <span className="neon text-[11px] tracking-[0.2em] uppercase terminal-caret">
                      sintetizando voz
                    </span>
                    <div className="w-48 meter"><span style={{ width: `${Math.min(95, elapsed * 12)}%` }} /></div>
                    <p className="text-muted text-[12px]">{elapsed}s decorridos</p>
                  </div>
                ) : !audio ? (
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
