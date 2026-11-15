"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Turn } from "@/types/domain";

// Which voice is actually sounding: our TTS, the browser's, or none at all (text only). Null while nothing has started.
export type Voice = "tts" | "browser" | "none" | null;
/** One sentence (or a whole reply) to say: its audio when there is some, and its words for the browser's voice. */
type Item = { data: ArrayBuffer | null; text: string };
/** A reply arriving in pieces. Push each sentence as it comes, then end. */
export type SpeechStream = { push: (item: Item) => void; end: () => void };

// A tenth of a second of silence, played once on the first tap so iOS lets this element play later replies
// that arrive without a tap.
function silence() {
  const samples = 800;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const text = (at: number, value: string) => [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples, true); text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, "data"); view.setUint32(40, samples, true);
  for (let index = 0; index < samples; index++) view.setUint8(44 + index, 128);
  return URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
}

/**
 * Plays the counterpart's replies. One audio element is reused for every reply: iOS only lets an element play
 * without a tap once it has played after one, so it is unlocked on the first tap or key press. If our speech
 * can't play, the browser's voice takes over for the rest of the reply; if that fails too, the reply stays as text.
 * `follow` gets each piece of audio just before it plays, e.g. to move the mouth.
 */
export function useSpeech(sessionId: string, counterpart: string, follow?: (player: HTMLAudioElement, data: ArrayBuffer) => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voice, setVoice] = useState<Voice>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const followRef = useRef(follow);
  useEffect(() => { followRef.current = follow; }, [follow]);
  const run = useRef(0);
  const player = useRef<HTMLAudioElement | null>(null);
  const finish = useRef<(() => void) | null>(null);
  const fetching = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  // The silent clip that unlocks the element. Stopping speech leaves it alone: the tap that starts a session also
  // stops any old reply, and cutting the clip off would leave iOS still locked.
  const unlocking = useRef<string | null>(null);

  const element = useCallback(() => {
    if (!player.current) { player.current = new Audio(); player.current.preload = "auto"; }
    return player.current;
  }, []);

  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      const audio = element();
      // Never interrupt a reply that is already playing.
      if (audio.src && !audio.paused) return;
      const url = silence();
      unlocking.current = url;
      audio.src = url;
      audio.play().then(() => { if (audio.src === url) audio.pause(); }, () => { if (audio.src === url) unlocked = false; }).finally(() => {
        URL.revokeObjectURL(url);
        if (unlocking.current === url) unlocking.current = null;
        if (audio.src === url) audio.removeAttribute("src");
      });
    };
    const events = ["pointerdown", "touchend", "keydown"] as const;
    events.forEach((name) => window.addEventListener(name, unlock, true));
    return () => events.forEach((name) => window.removeEventListener(name, unlock, true));
  }, [element]);

  const cancel = useCallback(() => {
    run.current++;
    fetching.current?.abort();
    fetching.current = null;
    const audio = player.current;
    if (audio && audio.src !== unlocking.current) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    finish.current?.();
    finish.current = null;
  }, []);

  const stop = useCallback(() => {
    cancel();
    if (mounted.current) { setIsSpeaking(false); setVoice(null); }
  }, [cancel]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancel(); };
  }, [cancel]);
  // Moving to another session stops the last one's voice. A new session getting its id is not a move: its
  // opening is already playing as it streams in.
  const previous = useRef(sessionId);
  useEffect(() => {
    if (previous.current && previous.current !== sessionId) stop();
    previous.current = sessionId;
  }, [sessionId, stop]);

  /** Plays one piece of our speech to the end. False when it couldn't play. */
  const playAudio = useCallback((data: ArrayBuffer, active: () => boolean) => new Promise<boolean>((resolve) => {
    const audio = element();
    const url = URL.createObjectURL(new Blob([data], { type: "audio/mpeg" }));
    let done = false;
    const end = (played: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      audio.onended = audio.onerror = audio.onplaying = null;
      if (finish.current === stopNow) finish.current = null;
      URL.revokeObjectURL(url);
      resolve(played);
    };
    const stopNow = () => end(true);
    const timeout = window.setTimeout(() => { audio.pause(); end(false); }, 45_000);
    finish.current = stopNow;
    audio.onended = () => end(true);
    audio.onerror = () => end(false);
    audio.onplaying = () => { if (active()) setVoice("tts"); };
    audio.src = url;
    followRef.current?.(audio, data);
    audio.play().catch(() => end(false));
  }), [element]);

  /** Says one piece in the browser's voice. False when the browser has no voice or playback failed. */
  const browserSay = useCallback((text: string, active: () => boolean) => new Promise<boolean>((resolve) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") { resolve(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    let settled = false;
    let started = false;
    const end = (spoken: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimeout);
      clearTimeout(endTimeout);
      if (finish.current === stopNow) finish.current = null;
      resolve(spoken);
    };
    const stopNow = () => end(true);
    const startTimeout = window.setTimeout(() => { if (!started) { window.speechSynthesis.cancel(); end(false); } }, 4000);
    const endTimeout = window.setTimeout(() => { window.speechSynthesis.cancel(); end(false); }, 45_000);
    utterance.onstart = () => { started = true; clearTimeout(startTimeout); if (active()) setVoice("browser"); };
    utterance.onend = () => end(true);
    utterance.onerror = () => end(false);
    finish.current = stopNow;
    try { window.speechSynthesis.speak(utterance); } catch { end(false); }
  }), []);

  /** Starts a reply that arrives in pieces. Speaking starts with the first piece and ends after the last. */
  const stream = useCallback((): SpeechStream => {
    cancel();
    const current = run.current;
    const active = () => mounted.current && run.current === current;
    const queue: Item[] = [];
    let ended = false;
    let wake: (() => void) | null = null;
    const next = async () => {
      while (!queue.length && !ended && active()) await new Promise<void>((resolve) => { wake = resolve; });
      return active() ? queue.shift() ?? null : null;
    };
    setIsSpeaking(true);
    setVoice(null);
    setNotice(null);
    void (async () => {
      let browser = false;
      try {
        for (let item = await next(); item; item = await next()) {
          if (item.data && !browser && await playAudio(item.data, active)) continue;
          if (!active()) return;
          if (!browser) { browser = true; setNotice(`Using your browser’s voice. The ${counterpart}’s reply is also shown as text.`); }
          if (!await browserSay(item.text, active)) {
            if (!active()) return;
            setVoice("none");
            setNotice(`Playback was blocked or isn’t available. Select Hear the ${counterpart} to try again, or read the reply above.`);
            return;
          }
        }
      } finally {
        if (active()) {
          setIsSpeaking(false);
          // Keep "none" so the counterpart stays still after a failed playback; otherwise nothing is sounding now.
          setVoice((value) => value === "none" ? "none" : null);
        }
      }
    })();
    return {
      push(item) { if (!active() || ended) return; queue.push(item); wake?.(); },
      end() { ended = true; wake?.(); },
    };
  }, [cancel, playAudio, browserSay, counterpart]);

  /** Speaks a saved reply, fetching its audio first. */
  const speak = useCallback(async (turn: Turn) => {
    if (!turn.text.trim()) return;
    const speech = stream();
    const controller = new AbortController();
    fetching.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 14_000);
    try {
      const response = await fetch("/api/speak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, turnId: turn.id }), signal: controller.signal,
      });
      if (!response.ok) throw new Error("Speech unavailable");
      const data = await response.arrayBuffer();
      if (!data.byteLength) throw new Error("Empty speech");
      speech.push({ data, text: turn.text });
    } catch {
      speech.push({ data: null, text: turn.text });
    } finally {
      clearTimeout(timeout);
      if (fetching.current === controller) fetching.current = null;
      speech.end();
    }
  }, [sessionId, stream]);

  return { speak, stream, stop, isSpeaking, voice, notice };
}
