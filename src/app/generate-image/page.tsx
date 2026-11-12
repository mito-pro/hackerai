"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type Model = { id: string; label: string; type: string };

export default function GenerateImagePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const [image, setImage] = useState<string | null>(null);
  const [model, setModel] = useState("");
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
      .then((m) => setModels(m.filter((x) => x.type === "image")))
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
    setImage(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: model || "nvidia/nemotron-3.5-super-vl-120b-a12b",
          prompt: prompt.trim(),
          width: Number(width) || 1024,
          height: Number(height) || 1024,
        }),
      });
      const data = await readJsonSafe<{ ok?: boolean; image?: string; mime?: string; model?: string; error?: string }>(res);
      if (!res.ok) {
        setError(data?.error || "Falha ao gerar imagem.");
        return;
      }
      setImage(data?.image ?? null);
      setMessage("Imagem gerada com sucesso.");
    } catch {
      setError("Falha de rede ao gerar imagem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-neon text-2xl tracking-[0.2em] uppercase mb-6">
          [ gerar imagem ]
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
          <div>
            <label className="label text-[12px]">prompt</label>
            <textarea
              className="input min-h-[80px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="descreva a imagem desejada..."
            />
          </div>
          <div>
            <label className="label text-[12px]">largura</label>
            <input
              className="input"
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="1024"
            />
          </div>
          <div>
            <label className="label text-[12px]">altura</label>
            <input
              className="input"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="1024"
            />
          </div>
          <div className="col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="btn btn-primary py-3 text-sm tracking-wider uppercase"
            >
              {loading ? "gerando..." : "gerar imagem"}
            </button>
          </div>
        </form>

        {image && (
          <section className="panel p-5 mb-6">
            <h2 className="text-neon text-sm tracking-[0.18em] uppercase mb-3">
              resultado
            </h2>
            <div className="flex items-center gap-4 bg-[#0a0a0a] border border-line rounded-lg p-3">
              <img src={image} alt="gerado" className="max-h-64 rounded border border-line" />
              <div className="flex-1 text-[12px] text-muted">
                <p className="mb-2">modelo: {model || "padrao"}</p>
                <p className="mb-2">tamanho: {width}x{height}</p>
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = image;
                    a.download = `nexus-imagem-${Date.now()}.png`;
                    a.click();
                  }}
                  className="btn btn-xs btn-neon"
                >
                  baixar imagem
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
