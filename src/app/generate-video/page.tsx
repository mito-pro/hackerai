"use client";

import { useEffect, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/utils";
import DecodeText from "@/components/fx/decode-text";

type Model = { id: string; label: string; type: string; provider?: string };

const DEFAULT_MODEL = "pollinations/default";

const ASPECTS: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 900, h: 900 },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("nao foi possivel carregar a imagem base"));
    img.src = src;
  });
}

async function renderLocalVideo(options: {
  image: string;
  prompt: string;
  seconds: number;
  aspect: string;
  onProgress?: (pct: number) => void;
}): Promise<string> {
  const size = ASPECTS[options.aspect] ?? ASPECTS["16:9"];
  const img = await loadImage(options.image);

  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponivel neste navegador");

  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";
  if (!mime) throw new Error("gravacao de video nao suportada neste navegador");

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 5_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();

  const durationMs = Math.min(Math.max(options.seconds, 3), 12) * 1000;
  const startedAt = performance.now();

  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const zoom = 1.04 + t * 0.2;
      const panX = Math.sin(t * Math.PI) * size.w * 0.04;
      const panY = (1 - Math.cos(t * Math.PI * 0.5)) * size.h * 0.03;

      const scale = Math.max(size.w / img.width, size.h / img.height) * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.drawImage(
        img,
        (size.w - drawW) / 2 + panX,
        (size.h - drawH) / 2 + panY,
        drawW,
        drawH
      );

      ctx.fillStyle = "rgba(5, 5, 7, 0.35)";
      ctx.fillRect(0, size.h - 96, size.w, 96);
      ctx.fillStyle = "#00ff9c";
      ctx.font = `600 ${Math.round(size.w / 46)}px monospace`;
      const label = options.prompt.slice(0, 46);
      ctx.fillText(label, 24, size.h - 52);
      ctx.fillStyle = "rgba(0, 255, 156, 0.25)";
      ctx.fillRect(24, size.h - 36, size.w - 48, 4);
      ctx.fillStyle = "#00ff9c";
      ctx.fillRect(24, size.h - 36, (size.w - 48) * t, 4);

      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      for (let y = 0; y < size.h; y += 4) ctx.fillRect(0, y, size.w, 1);

      options.onProgress?.(Math.round(t * 100));

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  const blob = await stopped;
  return URL.createObjectURL(blob);
}

export default function GenerateVideoPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspect, setAspect] = useState("16:9");
  const [sound, setSound] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [video, setVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const aborter = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/models?type=video", { cache: "no-store" })
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

  async function generateLocal(reason: string) {
    setMessage(
      `${reason} Gerando video local com animacao da imagem IA...`
    );
    setProgress(0);
    const imageRes = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "pollinations/flux",
        prompt: prompt.trim(),
        width: 1024,
        height: 1024,
      }),
    });
    const imageData = await readJsonSafe<{ image?: string; message?: string }>(
      imageRes
    );
    if (!imageRes.ok || !imageData?.image) {
      throw new Error(imageData?.message || "falha ao gerar a imagem base.");
    }

    const url = await renderLocalVideo({
      image: imageData.image,
      prompt: prompt.trim(),
      seconds: Number(duration) || 5,
      aspect,
      onProgress: setProgress,
    });
    setVideo(url);
    setMessage(
      "Video local gerado (animacao com IA). Os provedores remotos estao limitados agora."
    );
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
    setVideo(null);
    setProgress(0);
    startTimer();
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
      const data = await readJsonSafe<{
        ok?: boolean;
        video?: string;
        model?: string;
        provider?: string;
        usedFallback?: boolean;
        message?: string;
        error?: string;
      }>(res);

      if (res.ok && data?.video) {
        setVideo(data.video);
        setMessage(
          data.usedFallback
            ? `Video gerado via ${data.provider}.`
            : "Video gerado com sucesso."
        );
        return;
      }

      if (data?.error && data.error !== "generation_failed") {
        setError(data.message || data.error);
        return;
      }

      await generateLocal(data?.message || "Provedores de video indisponiveis.");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      try {
        await generateLocal("Falha no provedor remoto.");
      } catch (localError) {
        setError(
          (localError as Error).message || "Falha ao gerar o video."
        );
      }
    } finally {
      stopTimer();
      setLoading(false);
      setProgress(0);
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
              <DecodeText text="[ gerar video ]" />
            </h1>
            <p className="text-muted text-[13px]">
              Videos com IA: Pollinations, RunAPI e modo local com animacao.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.2em] uppercase text-muted border border-line px-2 py-1 rounded">
              nexus_video_v2
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
                    modelo de video
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
                      min="3"
                      max="12"
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
                  {loading ? `gerando... ${elapsed}s` : "gerar video agora"}
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
                  <div className="text-center flex flex-col items-center gap-3 w-full">
                    <span className="neon text-[11px] tracking-[0.2em] uppercase terminal-caret">
                      renderizando video
                    </span>
                    <div className="w-48 meter">
                      <span style={{ width: `${Math.max(progress, elapsed * 6)}%` }} />
                    </div>
                    <p className="text-muted text-[12px]">
                      {elapsed}s decorridos{progress ? ` · ${progress}%` : ""}
                    </p>
                  </div>
                ) : !video ? (
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
                    <video
                      controls
                      autoPlay
                      loop
                      className="w-full max-h-[500px] rounded-lg border border-neon/30 shadow-[0_0_30px_rgba(0,255,136,0.15)]"
                      src={video}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = video;
                        a.download = `nexus-video-${Date.now()}.webm`;
                        a.click();
                      }}
                      className="absolute -bottom-6 left-1/2 -translate-x-1/2 btn btn-xs btn-neon"
                    >
                      baixar video (.webm)
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
