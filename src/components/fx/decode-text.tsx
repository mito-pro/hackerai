"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "<>/*+-=[]{}#@$%&0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type DecodeTextProps = {
  text: string;
  speed?: number;
  className?: string;
};

export default function DecodeText({ text, speed = 34, className }: DecodeTextProps) {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(text);
      return;
    }

    let last = 0;
    const total = text.length;

    const tick = (now: number) => {
      if (now - last >= speed) {
        last = now;
        frame.current += 1;
        const revealed = frame.current;
        let out = "";
        for (let i = 0; i < total; i += 1) {
          if (text[i] === " ") {
            out += " ";
          } else if (i < revealed) {
            out += text[i];
          } else {
            out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        }
        setDisplay(out);
        if (revealed >= total + 6) {
          setDisplay(text);
          return;
        }
      }
      raf.current = requestAnimationFrame(tick);
    };

    frame.current = 0;
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [text, speed]);

  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  );
}
