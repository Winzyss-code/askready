"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

const BAR = 3;
const STEP = 6;

/** Root-mean-square level of the current microphone frame, scaled to roughly 0–1 for speech. */
export function readLevel(analyser: AnalyserNode, samples: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) { const centred = (sample - 128) / 128; sum += centred * centred; }
  return Math.min(1, Math.sqrt(sum / samples.length) * 3.4);
}

/** Rolling level history drawn from the real microphone signal. With no analyser it rests as a dotted baseline. */
export function Waveform({ analyser, className }: { analyser: AnalyserNode | null; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const styles = getComputedStyle(element);
    const ink = styles.getPropertyValue("--color-ink").trim();
    const rest = styles.getPropertyValue("--color-neutral-300").trim();
    const levels: number[] = [];
    let width = 0;
    let height = 0;

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const slots = Math.floor(width / STEP);
      for (let slot = 0; slot < slots; slot++) {
        const level = levels[levels.length - slots + slot];
        const barHeight = level === undefined ? 2 : Math.max(2, level * height);
        context.fillStyle = level === undefined ? rest : ink;
        context.beginPath();
        context.roundRect(slot * STEP, (height - barHeight) / 2, BAR, barHeight, BAR / 2);
        context.fill();
      }
    };
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const box = element.getBoundingClientRect();
      width = box.width; height = box.height;
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    if (!analyser) return () => observer.disconnect();

    const samples = new Uint8Array(analyser.fftSize);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sampler = window.setInterval(() => {
      levels.push(readLevel(analyser, samples));
      if (levels.length > 400) levels.shift();
      draw();
    }, calm ? 250 : 60);
    return () => { window.clearInterval(sampler); observer.disconnect(); };
  }, [analyser]);

  return <canvas ref={canvas} aria-hidden="true" className={cx("block h-10 w-full", className)} />;
}
