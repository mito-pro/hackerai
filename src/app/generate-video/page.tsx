"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type Model = { id: string; label: string; type: string };

export default function GenerateVideoPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspect, setAspect] = useState("16:9");
  const [sound, setSound] = useState(false);
  const [model, setModel] = useState("");
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
          model: model || "kling-v2.1-standard",
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
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-neon text-2xl tracking-[0.2em] uppercase mb-6">
          [ gerar video ]
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
              <option value="">padrao (RunAPI Kling)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label text-[12px]">prompt</label>
            <textarea
              className="input min-h-[100px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="descreva o video desejado..."
            />
          </div>
          <div>
            <label className="label text-[12px]">imagem opcional</label>
            <input
              className="input"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="url da imagem para transformar em video"
            />
          </div>
          <div>
            <label className="label text-[12px]">duracao (s)</label>
            <input
              className="input"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="5"
            />
          </div>
          <div>
            <label className="label text-[12px]">proporcao</label>
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => setSound(e.target.checked)}
            />
            <label className="text-[12px] text-muted cursor-pointer">ativar som</label>
          </div>
          <div className="col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="btn btn-primary py-3 text-sm tracking-wider uppercase"
            >
              {loading ? "gerando..." : "gerar video"}
            </button>
          </div>
        </form>

        {video && (
          <section className="panel p-5 mb-6">
            <h2 className="text-neon text-sm tracking-[0.18em] uppercase mb-3">
              resultado
            </h2>
            <div className="flex flex-col gap-3 bg-[#0a0a0a] border border-line rounded-lg p-3">
              <video controls className="w-full max-h-64 rounded border border-line" src={video} />
              <div className="flex items-center justify-between text-[12px] text-muted">
                <span>modelo: {model || "padrao"}</span>
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = video;
                    a.download = `nexus-video-${Date.now()}.mp4`;
                    a.click();
                  }}
                  className="btn btn-xs btn-neon"
                >
                  baixar video
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
