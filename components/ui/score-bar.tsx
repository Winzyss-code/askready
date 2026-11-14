"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cx } from "@/lib/cx";

type Tone = "ink" | "muted";
const clamp = (value: number) => Math.max(0, Math.min(100, value));

/** A 0–100 bar. Pass `from` to grow it out of an earlier value once it scrolls into view. */
export function Bar({ value, tone = "ink", from, delay = 0, className }: { value: number; tone?: Tone; from?: number; delay?: number; className?: string }) {
  const still = useReducedMotion();
  const fill = cx("block h-full rounded-full", tone === "ink" ? "bg-ink" : "bg-neutral-400");
  return (
    <span aria-hidden="true" className={cx("block h-2 w-full overflow-hidden rounded-full bg-neutral-200", className)}>
      {from === undefined
        ? <span className={fill} style={{ width: `${clamp(value)}%` }} />
        : <motion.span className={fill} initial={{ width: `${clamp(from)}%` }} whileInView={{ width: `${clamp(value)}%` }} viewport={{ once: true, amount: 0.6 }} transition={still ? { duration: 0 } : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }} />}
    </span>
  );
}

/** Label left, bar in the middle, figure tight to the right edge. */
export function ScoreBar({ label, value, tone = "ink", className }: { label: string; value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cx("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)_2.5rem]", className)}>
      <span className="text-sm font-semibold">{label}</span>
      <Bar value={value} tone={tone} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
      <span className="figure col-start-2 row-start-1 text-right text-lg sm:col-start-auto sm:row-start-auto">{value}<span className="sr-only"> out of 100</span></span>
    </div>
  );
}
