"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "cn";

type BinaryTrigger = "view" | "mount" | "hover";

const DEFAULT_SPEED = 50;
const DEFAULT_STAGGER = 80;
const DEFAULT_STEPS = 8;

function bitsFor(place: number, steps: number): Array<"0" | "1"> {
  let value = (place * 13 + 7) & 1;
  const bits: Array<"0" | "1"> = [];
  for (let step = 0; step < steps; step++) {
    const flip = ((place + 1) * (step + 3) * 17) % 4 !== 0;
    if (flip) value ^= 1;
    bits.push(value ? "1" : "0");
  }
  return bits;
}

export function BinaryText({
  text,
  bitColor,
  speed = DEFAULT_SPEED,
  stagger = DEFAULT_STAGGER,
  steps = DEFAULT_STEPS,
  trigger = "view",
  className,
  onSettle,
}: {
  text: string;
  bitColor?: string;
  speed?: number;
  stagger?: number;
  steps?: number;
  trigger?: BinaryTrigger;
  className?: string;
  onSettle?: () => void;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const onSettleRef = useRef(onSettle);
  const [playing, setPlaying] = useState(trigger === "mount");
  onSettleRef.current = onSettle;

  useEffect(() => {
    if (trigger !== "view") return;
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setPlaying(true);
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [trigger]);

  useEffect(() => {
    if (trigger === "hover") {
      const hover = window.matchMedia("(hover: hover)");
      if (!hover.matches) onSettleRef.current?.();
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      onSettleRef.current?.();
      return;
    }
    if (!playing) return;
    const glyphs = Math.max(1, Array.from(text).filter((char) => char.trim()).length);
    const duration = speed * steps + stagger * (glyphs - 1) + speed;
    const id = window.setTimeout(() => onSettleRef.current?.(), duration);
    return () => window.clearTimeout(id);
  }, [playing, speed, stagger, steps, text, trigger]);

  const chars = Array.from(text);
  return (
    <span
      ref={rootRef}
      data-slot="binary-text"
      data-state={playing ? "play" : "idle"}
      className={cn("binary-text", className)}
      style={{
        "--binary-text-steps": String(steps),
        "--binary-text-bit-color": bitColor ?? "color-mix(in oklab, currentColor 45%, transparent)",
      } as CSSProperties}
      onMouseEnter={trigger === "hover" ? () => setPlaying(true) : undefined}
      onMouseLeave={
        trigger === "hover"
          ? () => {
              setPlaying(false);
              onSettleRef.current?.();
            }
          : undefined
      }
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden className="binary-text-line">
        {chars.map((char, index) => {
          const glyph = char === " " ? "\u00a0" : char;
          return (
            <span key={`${char}-${index}`} className="binary-char">
              <span className="binary-sizer">{glyph}</span>
              {char.trim() ? (
                <span
                  className="binary-col"
                  style={{
                    animationDuration: `${speed * steps}ms`,
                    animationTimingFunction: `steps(${steps}, end)`,
                    animationDelay: `${index * stagger}ms`,
                  }}
                >
                  {bitsFor(index, steps).map((bit, step) => (
                    <span key={step} className="binary-bit">
                      {bit}
                    </span>
                  ))}
                  <span className="binary-glyph">{glyph}</span>
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Default shimmer is 2s. 0.6× speed stretches one sweep to about 3.3s. */
export const thinkingShimmerClass =
  "shimmer-color-primary shimmer-duration-3333 supports-[color:oklch(from_white_l_c_h)]:shimmer";

const settledTurns = new Set<string>();

/** Decodes the word once, then holds the theme shimmer for the rest of the turn. */
export function LiveThinkingText({ text = "Thinking", onceKey }: { text?: string; onceKey?: string }) {
  const [settled, setSettled] = useState(() => (onceKey ? settledTurns.has(onceKey) : false));

  function settle() {
    if (onceKey) settledTurns.add(onceKey);
    setSettled(true);
  }

  if (settled) {
    return (
      <span className={cn(thinkingShimmerClass, "font-mono font-medium text-foreground")}>
        {text}
      </span>
    );
  }
  return (
    <BinaryText
      text={text}
      trigger="mount"
      className="font-mono font-medium text-foreground"
      onSettle={settle}
    />
  );
}
