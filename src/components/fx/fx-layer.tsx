"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソ0123456789ABCDEF<>/*+-=$#";

export default function FxLayer() {
  const progressRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    let raf = 0;
    let pointerX = -999;
    let pointerY = -999;

    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      if (progressRef.current) {
        progressRef.current.style.width = `${pct.toFixed(2)}%`;
      }
    };

    const onPointer = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${pointerX - 220}px, ${pointerY - 220}px, 0)`;
        glowRef.current.style.opacity = "1";
      }
    };

    const onLeave = () => {
      if (glowRef.current) glowRef.current.style.opacity = "0";
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (!reduced && !coarse) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerleave", onLeave);
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    let columns: number[] = [];
    let fontSize = 14;
    let width = 0;
    let height = 0;
    let lastFrame = 0;

    const resize = () => {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      fontSize = width < 640 ? 12 : 15;
      const count = Math.ceil(width / fontSize);
      columns = Array.from({ length: count }, () => Math.random() * -50);
    };

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (!canvas || !ctx) return;
      if (time - lastFrame < 66) return;
      lastFrame = time;

      ctx.fillStyle = "rgba(5, 5, 7, 0.12)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns.length; i += 1) {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * fontSize;
        const y = columns[i] * fontSize;
        ctx.fillStyle = Math.random() > 0.975 ? "#d7ffe9" : "rgba(0, 255, 156, 0.55)";
        ctx.fillText(glyph, x, y);
        if (y > height && Math.random() > 0.975) columns[i] = 0;
        columns[i] += 1;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduced) raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" ref={progressRef} aria-hidden="true" />
      <div className="cursor-glow" ref={glowRef} aria-hidden="true" />
      <canvas className="fx-canvas" ref={canvasRef} aria-hidden="true" />
    </>
  );
}
