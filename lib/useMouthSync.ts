"use client";

import { useCallback, useEffect, useRef } from "react";

type Route = { source: MediaElementAudioSourceNode; analyser: AnalyserNode };
const samples = 1024;

/**
 * How open the counterpart's mouth is, 0 to 1, from the audio that is actually playing.
 * `mouth` is a ref the character reads every frame, so speech never re-renders React.
 * Pass `connect` to the speech hook: it routes each reply's audio element through an analyser
 * on its way to the speakers. Without a running AudioContext (no tap or keypress yet, or no
 * Web Audio), or for browser speech, the mouth follows a speech-like pattern instead.
 */
export function useMouthSync(speaking: boolean) {
  const mouth = useRef(0);
  const context = useRef<AudioContext | null>(null);
  const route = useRef<Route | null>(null);

  // Browsers only let audio contexts run after a user gesture, so create and resume one on the first tap or key.
  useEffect(() => {
    const unlock = () => {
      try {
        context.current ??= new AudioContext();
        if (context.current.state === "suspended") void context.current.resume().catch(() => {});
      } catch { context.current = null; }
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      const closing = context.current;
      context.current = null;
      route.current = null;
      void closing?.close().catch(() => {});
    };
  }, []);

  const connect = useCallback((player: HTMLAudioElement) => {
    route.current = null;
    const audio = context.current;
    // Once an element is routed into a context it only sounds through that context; a suspended one would be silent.
    if (!audio || audio.state !== "running") return;
    try {
      const source = audio.createMediaElementSource(player);
      const analyser = audio.createAnalyser();
      analyser.fftSize = samples;
      source.connect(analyser);
      analyser.connect(audio.destination);
      const own: Route = { source, analyser };
      route.current = own;
      const release = () => {
        source.disconnect();
        analyser.disconnect();
        if (route.current === own) route.current = null;
      };
      player.addEventListener("ended", release, { once: true });
      player.addEventListener("emptied", release, { once: true });
    } catch { route.current = null; }
  }, []);

  useEffect(() => {
    if (!speaking) { mouth.current = 0; return; }
    const buffer = new Float32Array(samples);
    let frame = 0;
    let target = 0;
    let nextSyllable = 0;
    const tick = (time: number) => {
      const analyser = route.current?.analyser;
      if (analyser) {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const value of buffer) sum += value * value;
        const rms = Math.sqrt(sum / buffer.length);
        target = Math.min(1, Math.max(0, (rms - 0.015) / 0.12));
      } else if (time >= nextSyllable) {
        // No signal to read: open and close on a syllable-like rhythm, with the odd pause.
        target = Math.random() < 0.18 ? 0 : 0.25 + Math.random() * 0.65;
        nextSyllable = time + 90 + Math.random() * 110;
      }
      // Fast attack, slower release, so the mouth snaps open on a syllable and eases shut.
      mouth.current += (target - mouth.current) * (target > mouth.current ? 0.55 : 0.18);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); mouth.current = 0; };
  }, [speaking]);

  return { mouth, connect };
}
