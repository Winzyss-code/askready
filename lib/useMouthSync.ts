"use client";

import { useCallback, useEffect, useRef } from "react";

// Loudness is sampled every 20 ms of audio.
const STEP = 0.02;
type Track = { player: HTMLAudioElement; envelope: Float32Array | null };
type OfflineContext = typeof OfflineAudioContext;

/** The reply's loudness over time, decoded from the audio file itself. Null where the browser can't decode. */
async function envelopeOf(data: ArrayBuffer): Promise<Float32Array | null> {
  const Offline = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: OfflineContext }).webkitOfflineAudioContext;
  if (!Offline) return null;
  // decodeAudioData takes ownership of the buffer it's given, so it gets a copy.
  const buffer = await new Offline(1, 1, 22_050).decodeAudioData(data.slice(0));
  const samples = buffer.getChannelData(0);
  const step = Math.max(1, Math.round(buffer.sampleRate * STEP));
  const envelope = new Float32Array(Math.ceil(samples.length / step));
  for (let index = 0; index < envelope.length; index++) {
    let sum = 0;
    const end = Math.min(samples.length, (index + 1) * step);
    for (let at = index * step; at < end; at++) sum += samples[at] * samples[at];
    const rms = Math.sqrt(sum / Math.max(1, end - index * step));
    envelope[index] = Math.min(1, Math.max(0, (rms - 0.015) / 0.12));
  }
  return envelope;
}

/**
 * How open the counterpart's mouth is, 0 to 1, from the audio that is actually playing.
 * `mouth` is a ref the character reads every frame, so speech never re-renders React.
 * Pass `follow` to the speech hook: it gets each reply's audio before it plays, decodes its loudness, and the
 * mouth reads that at the player's current time. The audio itself plays normally, never through Web Audio, so a
 * suspended audio context (no tap yet, or iOS after an interruption) can't silence it. Until the loudness is
 * decoded, or for browser speech, the mouth follows a speech-like pattern instead.
 */
export function useMouthSync(speaking: boolean) {
  const mouth = useRef(0);
  const track = useRef<Track | null>(null);

  const follow = useCallback((player: HTMLAudioElement, data: ArrayBuffer) => {
    const entry: Track = { player, envelope: null };
    track.current = entry;
    void envelopeOf(data).then((envelope) => { if (track.current === entry) entry.envelope = envelope; }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!speaking) { mouth.current = 0; return; }
    let frame = 0;
    let target = 0;
    let nextSyllable = 0;
    const tick = (time: number) => {
      const current = track.current;
      if (current?.envelope && !current.player.paused) {
        target = current.envelope[Math.floor(current.player.currentTime / STEP)] ?? 0;
      } else if (time >= nextSyllable) {
        // No loudness to read: open and close on a syllable-like rhythm, with the odd pause.
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

  return { mouth, follow };
}
