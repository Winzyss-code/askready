"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { readLevel } from "@/components/ui/waveform";
import { cx } from "@/lib/cx";
import type { Emotion } from "@/lib/emotion";

export type CharacterState = "idle" | "listening" | "thinking" | "speaking";
// "concerned" is ours, never the model's: it shows when the microphone or a request fails.
export type CharacterEmotion = Emotion | "concerned";
/** A number, or a ref the mouth reads every frame (see lib/useMouthSync.ts) so speech never re-renders React. */
export type MouthSource = number | { readonly current: number };

// Everything is drawn in a 100-unit box. Brows are [lift, rotation in degrees] for the left and right brow;
// a positive rotation pulls the inner end down. Mouth curve lifts the corners; tilt lifts only the right one.
type Mouth = { width: number; curve: number; tilt: number; open: number };
type Face = { brows: [[number, number], [number, number]]; mouth: Mouth; cheeks: boolean };
const faces: Record<CharacterEmotion, Face> = {
  neutral: { brows: [[0, 0], [0, 0]], mouth: { width: 7, curve: 1, tilt: 0, open: 0 }, cheeks: false },
  skeptical: { brows: [[1, 7], [-5, 6]], mouth: { width: 7, curve: 0, tilt: 2.5, open: 0 }, cheeks: false },
  warm: { brows: [[-2, -5], [-2, -5]], mouth: { width: 9, curve: 5, tilt: 0, open: 0 }, cheeks: true },
  impatient: { brows: [[2, 13], [2, 13]], mouth: { width: 8, curve: -0.5, tilt: 0, open: 0 }, cheeks: false },
  impressed: { brows: [[-6, -2], [-6, -2]], mouth: { width: 8, curve: 4, tilt: 0, open: 0.25 }, cheeks: true },
  concerned: { brows: [[-2, -15], [-2, -15]], mouth: { width: 6, curve: -3, tilt: 0, open: 0 }, cheeks: false },
};
// One small variation per temperament: brow shape and set, and glasses for the skeptic.
type Look = { brow: string; weight: number; set: number; glasses?: boolean };
const looks: Record<string, Look> = {
  budget: { brow: "M-8 0 L8 0", weight: 4.4, set: 7 },
  friendly: { brow: "M-8 2 Q0 -4 8 2", weight: 3.2, set: 0 },
  analyst: { brow: "M-7 0 L7 0", weight: 2.4, set: 0, glasses: true },
  guilt: { brow: "M-8 1.5 Q0 -3 8 1.5", weight: 3.2, set: -8 },
};
const gaze: Record<CharacterState, [number, number]> = { idle: [0, 0], listening: [0, 1], thinking: [-3, -4], speaking: [0, 0] };

function mouthPath({ width, curve, tilt, open }: Mouth) {
  const y = 71;
  const upper = y + curve * 0.9;
  return `M${50 - width} ${y - curve} Q50 ${upper} ${50 + width} ${y - curve - tilt} Q50 ${upper + open * 15} ${50 - width} ${y - curve}Z`;
}
const read = (source: MouthSource) => typeof source === "number" ? source : source.current;

/**
 * The counterpart: a small ink creature. State sets its posture and gaze, emotion sets brows, mouth and cheeks,
 * and the mouth follows mouthOpen while speaking. With reduced motion it holds still expressions.
 */
export function Character({ state, emotion = "neutral", mouthOpen = 0, persona = "", analyser = null, label, size = "lg", className }: {
  state: CharacterState; emotion?: CharacterEmotion; mouthOpen?: MouthSource; persona?: string;
  analyser?: AnalyserNode | null; label?: string; size?: "md" | "lg"; className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const mouth = useRef<SVGPathElement>(null);
  const still = Boolean(useReducedMotion());
  const face = faces[emotion];
  const look = looks[persona] ?? looks.friendly;
  const latest = useRef({ state, face, mouthOpen, analyser, still });
  const shown = useRef<Mouth>({ ...face.mouth });
  const frame = useRef(0);

  // The mouth is drawn outside React so speech never re-renders; this paints it before the first frame.
  useLayoutEffect(() => { mouth.current?.setAttribute("d", mouthPath(shown.current)); }, []);
  useLayoutEffect(() => { latest.current = { state, face, mouthOpen, analyser, still }; });

  // One loop draws the mouth and the listening nod. It runs while speaking or listening, or until an
  // expression change has settled, then stops; nothing runs at rest.
  useEffect(() => {
    const samples = analyser ? new Uint8Array(analyser.fftSize) : null;
    let level = 0;
    const tick = (time: number) => {
      const { state, face, mouthOpen, analyser, still } = latest.current;
      // With reduced motion, speaking is a still, half-open mouth, so the state still reads from shape.
      const spoken = state !== "speaking" ? 0 : still ? 0.35 : Math.min(1, Math.max(0, read(mouthOpen)));
      const goal: Mouth = { width: face.mouth.width + spoken * 1.5, curve: face.mouth.curve * (1 - spoken * 0.5), tilt: face.mouth.tilt, open: Math.max(face.mouth.open, spoken) };
      const now = shown.current;
      let moving = false;
      for (const key of ["width", "curve", "tilt", "open"] as const) {
        const next = still ? goal[key] : now[key] + (goal[key] - now[key]) * (key === "open" ? 0.6 : 0.25);
        if (Math.abs(goal[key] - next) > 0.02) moving = true;
        now[key] = Math.abs(goal[key] - next) > 0.02 ? next : goal[key];
      }
      mouth.current?.setAttribute("d", mouthPath(now));
      // Small nods while the user is talking, from the real microphone level.
      const listening = state === "listening" && analyser && samples && !still;
      if (listening) {
        level += (readLevel(analyser, samples) - level) * 0.2;
        svg.current?.style.setProperty("--nod", (level > 0.12 ? Math.sin(time / 170) * Math.min(1, level * 2) : 0).toFixed(3));
      } else svg.current?.style.setProperty("--nod", "0");
      frame.current = state === "speaking" && !still || listening || moving ? requestAnimationFrame(tick) : 0;
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [state, emotion, mouthOpen, analyser, still]);

  // Blink every three to six seconds, except while thinking (the eyes are looking away) or with reduced motion.
  useEffect(() => {
    const element = svg.current;
    if (!element || still || state === "thinking") return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        element.setAttribute("data-blink", "");
        timer = window.setTimeout(() => { element.removeAttribute("data-blink"); schedule(); }, 130);
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => { clearTimeout(timer); element.removeAttribute("data-blink"); };
  }, [still, state]);

  const brow = (side: 0 | 1) => {
    const [lift, turn] = face.brows[side];
    const rotation = (turn + look.set) * (side === 0 ? 1 : -1);
    return (
      <g transform={`translate(${side === 0 ? 37 : 63} 36)`}>
        <g className="char-part" style={{ transform: `translateY(${lift}px) rotate(${rotation}deg)` }}>
          <path d={look.brow} fill="none" stroke="var(--color-paper)" strokeWidth={look.weight} strokeLinecap="round" />
        </g>
      </g>
    );
  };
  const [gx, gy] = gaze[state];

  return (
    <svg
      ref={svg} viewBox="0 0 100 100" data-state={state} data-emotion={emotion}
      className={cx("char", size === "md" && "char-md", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <g className="char-figure">
        <g className="char-tap">
          <line x1="50" y1="17" x2="50" y2="8" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="7" r="3.6" fill="var(--color-marker)" />
          <path d="M50 16C77 16 90 30 90 55C90 79 76 92 50 92C24 92 10 79 10 55C10 30 23 16 50 16Z" fill="var(--color-ink)" />
          {face.cheeks && <g fill="var(--color-marker)" opacity="0.85"><ellipse cx="25" cy="64" rx="4.5" ry="2.6" /><ellipse cx="75" cy="64" rx="4.5" ry="2.6" /></g>}
          {[37, 63].map((x) => (
            <g key={x} className="char-eye">
              <ellipse cx={x} cy="51" rx="8.5" ry="9.5" fill="var(--color-paper)" />
              <g className="char-part" style={{ transform: `translate(${gx}px, ${gy}px)` }}><circle cx={x} cy="52" r={state === "listening" ? 4.8 : 4.2} fill="var(--color-ink)" /></g>
            </g>
          ))}
          {look.glasses && <g fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.6"><circle cx="37" cy="51" r="11.5" /><circle cx="63" cy="51" r="11.5" /><path d="M48.5 50Q50 48.5 51.5 50" /></g>}
          {brow(0)}{brow(1)}
          <path ref={mouth} fill="var(--color-paper)" stroke="var(--color-paper)" strokeWidth="3" strokeLinejoin="round" />
        </g>
      </g>
      {state === "thinking" && <g className="char-dots" fill="var(--color-neutral-400)"><circle cx="80" cy="20" r="2.6" /><circle cx="87" cy="13" r="3.2" /><circle cx="95" cy="5" r="3.8" /></g>}
    </svg>
  );
}
