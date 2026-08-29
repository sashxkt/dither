"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "!<>-_\\/[]{}=+*^?#@$%&";

function runScramble(el: HTMLElement, text: string, dur: number) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    el.textContent = text;
    return;
  }
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === " " || ch === "\n") {
        out += ch;
        continue;
      }
      const cp = p * text.length * 1.35 - i * 0.85;
      out += cp >= 1 ? ch : cp > 0 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : " ";
    }
    el.textContent = out;
    if (p < 1) raf = requestAnimationFrame(tick);
    else el.textContent = text;
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function Scramble({
  text,
  className,
  as: Tag = "span",
  hover = false,
  view = false,
}: {
  text: string;
  className?: string;
  as?: "span" | "a";
  hover?: boolean;
  view?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = text;
    let stop: (() => void) | undefined;

    const play = (dur: number) => {
      stop?.();
      stop = runScramble(el, text, dur);
    };

    const onEnter = () => play(320);
    if (hover) el.addEventListener("mouseenter", onEnter);

    let io: IntersectionObserver | undefined;
    if (view) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) play(640);
          });
        },
        { threshold: 0.4 }
      );
      io.observe(el);
    }

    return () => {
      stop?.();
      if (hover) el.removeEventListener("mouseenter", onEnter);
      io?.disconnect();
    };
  }, [text, hover, view]);

  return <Tag ref={ref as never} className={className}>{text}</Tag>;
}
