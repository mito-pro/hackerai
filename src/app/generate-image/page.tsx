"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";
import DecodeText from "@/components/fx/decode-text";

type Model = { id: string; label: string; type: string; provider?: string };

type SizePreset = { label: string; width: number; height: number };

const SIZE_PRESETS: SizePreset[] = [
  { label: "1:1 · 1024", width: 1024, height: 1024 },
  { label: "16:9 · 1280", width: 1280, height: 720 },
  { label: "9:16 · 720", width: 720, height: 1280 },
  { label: "4:3 · 1024", width: 1024, height: 768 },
];

const DEFAULT_MODEL = "pollinations/flux";

export default function GenerateImagePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("1024");
  const [image, setImage] = useState<string | null>(null);
  const [mime, setMime] = useState("image/png");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const aborter = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/models?type=image", { cache: "no-store" })
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
    if (!prompt.trim()) return;
    aborter.current?.abort();
    const ctrl = new AbortController();
    aborter.current = ctrl;
    setLoading(true);
    setError("");
    setMessage("");
    setImage(null);
    startTimer();
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
      const data = await readJsonSafe<{
        ok?: boolean;
        image?: string;
        mime?: string;
        model?: string;
        provider?: string;
        usedFallback?: boolean;
        message?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(data?.message || data?.error || "Falha ao gerar imagem.");
        return;
      }
      setImage(data?.image ?? null);
      setMime(data?.mime || "image/png");
      setMessage(
        data?.usedFallback
          ? `Imagem gerada via ${data.provider} (provedor principal indisponivel).`
          : "Imagem gerada com sucesso."
      );
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError("Falha de rede ao gerar imagem.");
    } finally {
      stopTimer();
      setLoading(false);
    }
  }

  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";

  const options = [
    ...models.map((m) => ({ value: m.id, label: m.label })),
  ];
  if (!options.some((o) => o.value === model)) {
    options.unshift({ value: model, label: model });
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#e8e8f0] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 fade-up">
          <div>
            <h1 className="text-neon text-3xl tracking-[0.2em] uppercase mb-1">
              <DecodeText text="[ gerar imagem ]" />
            </h1>
            <p className="text-muted text-[13px]">
              FLUX, Z-Image, MAI e mais com fallback automatico. Limite gratis de 1 imagem a cada 45s por IP.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted border border-line px-2 py-1 rounded">
              nexus_image_v2
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
                    modelo de imagem
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
                  <label className="label text-[12px] mb-2 block">proporcao</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SIZE_PRESETS.map((preset) => {
                      const active =
                        Number(width) === preset.width && Number(height) === preset.height;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setWidth(String(preset.width));
                            setHeight(String(preset.height));
                          }}
                          className={`btn btn-xs ${active ? "btn-primary" : ""}`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
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
                      step="64"
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
                      step="64"
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-[12px] mb-2 block">
                    prompt
                    <span className="float-right text-muted normal-case tracking-normal">
                      {prompt.length} chars
                    </span>
                  </label>
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
                  {loading
                    ? `gerando... ${elapsed}s`
                    : "gerar imagem agora"}
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
                      renderizando pixel
                    </span>
                    <div className="w-48 meter"><span style={{ width: `${Math.min(95, elapsed * 8)}%` }} /></div>
                    <p className="text-muted text-[12px]">
                      {elapsed}s decorridos · provedores em cadeia
                    </p>
                  </div>
                ) : !image ? (
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
                        a.download = `nexus-imagem-${Date.now()}.${ext}`;
                        a.click();
                      }}
                      className="absolute -bottom-6 left-1/2 -translate-x-1/2 btn btn-xs btn-neon"
                    >
                      baixar imagem (.{ext})
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
