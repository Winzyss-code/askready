"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Turn } from "@/types/domain";

// Which voice is actually sounding: our TTS, the browser's, or none at all (text only). Null while nothing has started.
export type Voice = "tts" | "browser" | "none" | null;

/** `connect` is given each reply's audio element before it plays, e.g. to route it through an analyser. */
export function useSpeech(sessionId: string, connect?: (player: HTMLAudioElement) => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voice, setVoice] = useState<Voice>(null);
  const connectRef = useRef(connect);
  useEffect(() => { connectRef.current = connect; }, [connect]);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const finish = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  const cancel = useCallback(() => {
    run.current++;
    abort.current?.abort();
    abort.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
      audio.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
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
  }, [cancel, sessionId]);

  const speak = useCallback(async (turn: Turn) => {
    cancel();
    const current = run.current;
    const active = () => mounted.current && run.current === current;
    if (!turn.text.trim() || !active()) return;
    setIsSpeaking(true);
    setVoice(null);
    setNotice(null);
    const controller = new AbortController();
    abort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 14_000);

    const browserSpeech = async () => {
      if (!active()) return;
      if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        setNotice("Audio is unavailable in this browser. You can read the manager’s reply above.");
        setVoice("none");
        return;
      }
      setNotice("Using your browser’s voice. The manager’s reply is also available as text.");
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(turn.text);
        utterance.lang = "en-US";
        let settled = false;
        let started = false;
        const end = () => {
          if (settled) return;
          settled = true;
          clearTimeout(startTimeout);
          clearTimeout(endTimeout);
          if (finish.current === end) finish.current = null;
          resolve();
        };
        const failed = () => {
          if (active()) setVoice("none");
          if (active()) setNotice("Playback was blocked or unavailable. Select Hear the manager to try again, or read the reply above.");
          end();
        };
        const startTimeout = window.setTimeout(() => {
          if (!started && active()) { window.speechSynthesis.cancel(); failed(); }
        }, 4000);
        const endTimeout = window.setTimeout(() => {
          if (active()) { window.speechSynthesis.cancel(); failed(); }
        }, 45_000);
        utterance.onstart = () => { started = true; clearTimeout(startTimeout); if (active()) setVoice("browser"); };
        utterance.onend = end;
        utterance.onerror = failed;
        finish.current = end;
        try { window.speechSynthesis.speak(utterance); } catch { failed(); }
      });
    };

    try {
      const response = await fetch("/api/speak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, turnId: turn.id }), signal: controller.signal,
      });
      if (!response.ok) throw new Error("Speech unavailable");
      const blob = await response.blob();
      if (!active()) return;
      if (!blob.size) throw new Error("Empty speech");
      clearTimeout(timeout);
      const url = URL.createObjectURL(blob);
      audioUrl.current = url;
      const player = new Audio(url);
      audio.current = player;
      await new Promise<void>((resolve, reject) => {
        const end = () => {
          clearTimeout(playbackTimeout);
          if (finish.current === end) finish.current = null;
          resolve();
        };
        const playbackTimeout = window.setTimeout(() => {
          player.pause(); reject(new Error("Playback timeout"));
        }, 45_000);
        finish.current = end;
        player.onended = end;
        player.onplaying = () => { if (active()) setVoice("tts"); };
        player.onerror = () => { clearTimeout(playbackTimeout); reject(new Error("Playback failed")); };
        connectRef.current?.(player);
        player.play().catch((error: unknown) => { clearTimeout(playbackTimeout); reject(error); });
      });
    } catch {
      if (active()) {
        audio.current?.pause();
        await browserSpeech();
      }
    } finally {
      clearTimeout(timeout);
      if (active()) {
        if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = null;
        audio.current = null;
        abort.current = null;
        finish.current = null;
        setIsSpeaking(false);
        // Keep "none" so the counterpart stays still after a failed playback; otherwise nothing is sounding now.
        setVoice((current) => current === "none" ? "none" : null);
      }
    }
  }, [cancel, sessionId]);

  return { speak, stop, isSpeaking, voice, notice };
}
