"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";

type Model = { id: string; label: string; type: string };

export default function GenerateImagePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const [image, setImage] = useState<string | null>(null);
  const [model, setModel] = useState("nvidia/sdxl");
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
          model,
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
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-neon text-3xl tracking-[0.2em] uppercase mb-1">
              [ gerar imagem ]
            </h1>
            <p className="text-muted text-[13px]">
              Crie imagens com IA usando NVIDIA SDXL ou RunAPI.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted border border-line px-2 py-1 rounded">
              nexus_image_v1
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
                    modelo de imagem
                  </label>
                  <select
                    className="input w-full"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="nvidia/sdxl">NVIDIA · SDXL 1.0</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label text-[12px] mb-2 block">largura</label>
                    <input
                      className="input"
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      min="256"
                      max="2048"
                      step="256"
                    />
                  </div>
                  <div>
                    <label className="label text-[12px] mb-2 block">altura</label>
                    <input
                      className="input"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      min="256"
                      max="2048"
                      step="256"
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">prompt</label>
                  <textarea
                    className="input min-h-[140px]"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: uma cidade cyberpunk futurista com neons roxos e azuis, estilo synthwave, 8k..."
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
                  {loading ? "gerando imagem..." : "gerar imagem agora"}
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
                {!image ? (
                  <div className="text-center flex flex-col items-center gap-3">
                    <span className="text-muted text-[11px] tracking-[0.2em] uppercase">
                      nenhum resultado ainda
                    </span>
                    <p className="text-muted text-[12px] max-w-xs">
                      preencha o prompt e clique em gerar imagem para ver o resultado aqui.
                    </p>
                  </div>
                ) : (
                  <div className="relative inline-block">
                    <img
                      src={image}
                      alt="gerado"
                      className="max-w-full max-h-[500px] rounded-lg border border-neon/30 shadow-[0_0_30px_rgba(0,255,136,0.15)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = image;
                        a.download = `nexus-imagem-${Date.now()}.png`;
                        a.click();
                      }}
                      className="absolute -bottom-6 left-1/2 -translate-x-1/2 btn btn-xs btn-neon"
                    >
                      baixar imagem (.png)
                    </button>
                  </div>
                )}
              </div>
              {image && (
                <div className="mt-4 p-3 rounded-lg bg-[#0a0a0a] border border-line text-[12px] text-muted">
                  <div className="flex justify-between mb-1">
                    <span className="text-neon">modelo:</span>
                    <span>{model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neon">tamanho:</span>
                    <span>{width}x{height}</span>
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
