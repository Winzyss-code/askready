"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { readLevel } from "@/components/ui/waveform";
import { cx } from "@/lib/cx";

export type ManagerState = "idle" | "listening" | "thinking" | "speaking";

// Width and height in em (the disc is 10em across) and opacity for each of the five marks.
type Mark = [width: number, height: number, opacity: number];
const gone: Mark = [0, 0.28, 0];
const shapes: Record<ManagerState, Mark[]> = {
  idle: [[0.6, 0.7, 1], [0.6, 1.2, 1], [0.6, 1.7, 1], [0.6, 1.2, 1], [0.6, 0.7, 1]],
  listening: [gone, gone, [1.7, 1.7, 1], gone, gone],
  thinking: [gone, [1.1, 1.1, 1], [1.1, 1.1, 1], [1.1, 1.1, 1], gone],
  speaking: [[0.6, 2.2, 1], [0.6, 3.9, 1], [0.6, 5.2, 1], [0.6, 3.2, 1], [0.6, 1.9, 1]],
};

/** The manager: a low waveform at rest, an open ring that follows your voice, three stepping dots inside an orbit ring, five tall bars. */
export function ManagerDisc({ state, analyser = null, size = "lg", className }: {
  state: ManagerState; analyser?: AnalyserNode | null; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const disc = useRef<HTMLSpanElement>(null);
  const still = useReducedMotion();

  useEffect(() => {
    const element = disc.current;
    if (!element || !analyser || state !== "listening" || still) return;
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let level = 0;
    const tick = () => {
      level += (readLevel(analyser, samples) - level) * 0.35;
      element.style.setProperty("--level", level.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); element.style.setProperty("--level", "0"); };
  }, [analyser, state, still]);

  return (
    <span ref={disc} aria-hidden="true" data-state={state} className={cx("disc", size === "sm" && "disc-sm", size === "md" && "disc-md", className)}>
      {shapes[state].map(([width, height, opacity], index) => (
        <motion.span
          key={index}
          className="disc-mark"
          style={{ "--i": index } as React.CSSProperties}
          initial={false}
          animate={{ width: `${width}em`, height: `${height}em`, opacity }}
          transition={still ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
        />
      ))}
    </span>
  );
}
