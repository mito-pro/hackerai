"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type Model = { id: string; label: string; type: string };

export default function GenerateVideoPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspect, setAspect] = useState("16:9");
  const [sound, setSound] = useState(false);
  const [model, setModel] = useState("runapi/kling-v2.1-standard");
  const [video, setVideo] = useState<string | null>(null);
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
      .then((m) => setModels(m.filter((x) => x.type === "video")))
      .catch(() => undefined);
  }, []);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    aborter.current?.abort();
    const ctrl = new AbortController();
    aborter.current = ctrl;
    setLoading(true);
    setError("");
    setMessage("");
    setVideo(null);
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          prompt: prompt.trim(),
          image_url: imageUrl.trim() || undefined,
          duration: Number(duration) || 5,
          aspect_ratio: aspect || "16:9",
          enable_sound: sound,
        }),
      });
      const data = await readJsonSafe<{ ok?: boolean; video?: string; model?: string; error?: string }>(res);
      if (!res.ok) {
        setError(data?.error || "Falha ao gerar video.");
        return;
      }
      setVideo(data?.video ?? null);
      setMessage("Video gerado com sucesso.");
    } catch {
      setError("Falha de rede ao gerar video.");
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
              [ gerar video ]
            </h1>
            <p className="text-muted text-[13px]">
              Crie videos com IA usando RunAPI Kling v2/v3.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted border border-line px-2 py-1 rounded">
              nexus_video_v1
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
                    modelo de video
                  </label>
                  <select
                    className="input w-full"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="runapi/kling-v2.1-standard">
                      RunAPI · Kling v2.1 Standard
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">prompt</label>
                  <textarea
                    className="input min-h-[140px]"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: um drão voando sobre uma cidade futurista com neons..."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label text-[12px] mb-2 block">duracao (s)</label>
                    <input
                      className="input"
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min="1"
                      max="15"
                    />
                  </div>
                  <div>
                    <label className="label text-[12px] mb-2 block">proporcao</label>
                    <select
                      className="input w-full"
                      value={aspect}
                      onChange={(e) => setAspect(e.target.value)}
                    >
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="1:1">1:1</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sound}
                      onChange={(e) => setSound(e.target.checked)}
                    />
                    ativar som
                  </label>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">imagem opcional (URL)</label>
                  <input
                    className="input"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="cole a URL de uma imagem para animar"
                  />
                </div>

                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || !prompt.trim()}
                  className={`w-full py-4 text-sm tracking-wider uppercase font-bold transition ${
                    loading || !prompt.trim()
                      ? "bg-[#1a1a24] border border-line text-muted cursor-not-allowed"
                      : "bg-neon text-[#050507] hover:bg-[#00ff88]"
                  }`}
                >
                  {loading ? "gerando video..." : "gerar video agora"}
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
                {!video ? (
                  <div className="text-center flex flex-col items-center gap-3">
                    <span className="text-muted text-[11px] tracking-[0.2em] uppercase">
                      nenhum resultado ainda
                    </span>
                    <p className="text-muted text-[12px] max-w-xs">
                      preencha o prompt e clique em gerar video para ver o resultado aqui.
                    </p>
                  </div>
                ) : (
                  <div className="relative inline-block w-full max-w-md">
                    <video controls className="w-full max-h-[500px] rounded-lg border border-neon/30 shadow-[0_0_30px_rgba(0,255,136,0.15)]" src={video} />
                    <button
                      type="button"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = video;
                        a.download = `nexus-video-${Date.now()}.mp4`;
                        a.click();
                      }}
                      className="absolute -bottom-6 left-1/2 -translate-x-1/2 btn btn-xs btn-neon"
                    >
                      baixar video (.mp4)
                    </button>
                  </div>
                )}
              </div>
              {video && (
                <div className="mt-4 p-3 rounded-lg bg-[#0a0a0a] border border-line text-[12px] text-muted">
                  <div className="flex justify-between mb-1">
                    <span className="text-neon">modelo:</span>
                    <span>{model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neon">duracao:</span>
                    <span>{duration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neon">proporcao:</span>
                    <span>{aspect}</span>
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
