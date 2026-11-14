"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis, Keyboard, Mic, MicOff, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { Waveform } from "@/components/ui/waveform";
import { cx } from "@/lib/cx";

type Props = {
  onSubmit: (text: string, audioDurationMs: number | null) => Promise<void>;
  disabled: boolean;
  sessionId: string;
  attempt: 0 | 1;
  onBusyChange?: (active: boolean) => void;
  onStateChange?: (state: ComposerState) => void;
  onMeter?: (analyser: AnalyserNode | null) => void;
  /** Shown in place of the default hint while the composer is disabled. */
  waitingHint?: string | null;
};
export type ComposerState = "idle" | "permission" | "recording" | "transcribing" | "sending";
const MAX_BYTES = 3_500_000;
const MAX_SECONDS = 90;
const RING = 2 * Math.PI * 45.5;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function VoiceComposer({ onSubmit, disabled, sessionId, attempt, onBusyChange, onStateChange, onMeter, waitingHint }: Props) {
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<ComposerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const meter = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const recorded = useRef<{ text: string; durationMs: number | null } | null>(null);
  const answerField = useRef<HTMLTextAreaElement>(null);
  const disabledRef = useRef(disabled);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => {
    onBusyChange?.(state !== "idle");
    return () => { onBusyChange?.(false); };
  }, [state, onBusyChange]);
  useEffect(() => {
    onStateChange?.(state);
    return () => { onStateChange?.("idle"); };
  }, [state, onStateChange]);
  useEffect(() => {
    onMeter?.(analyser);
    return () => { onMeter?.(null); };
  }, [analyser, onMeter]);
  useEffect(() => { if (voiceUnavailable) answerField.current?.focus(); }, [voiceUnavailable]);

  const releaseMedia = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void meter.current?.close().catch(() => undefined);
    meter.current = null;
    setAnalyser(null);
  };

  useEffect(() => () => {
    generation.current++;
    request.current?.abort();
    const current = recorder.current;
    if (current) {
      current.onstop = null;
      current.ondataavailable = null;
      if (current.state !== "inactive") current.stop();
    }
    releaseMedia();
  }, [sessionId, attempt]);

  async function startRecording() {
    if (disabled || state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceUnavailable(true);
      setNotice("Recording isn’t supported here. Type your answer below; the same coaching applies.");
      return;
    }
    setError(null);
    setNotice(null);
    setState("permission");
    const activeGeneration = ++generation.current;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (generation.current !== activeGeneration || disabledRef.current) {
        mic.getTracks().forEach((track) => track.stop());
        if (generation.current === activeGeneration) setState("idle");
        return;
      }
      stream.current = mic;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((value) => MediaRecorder.isTypeSupported(value));
      if (!mime) {
        releaseMedia();
        setState("idle");
        setVoiceUnavailable(true);
        setNotice("This browser doesn’t support a compatible recording format. Type your answer below.");
        return;
      }
      const next = new MediaRecorder(mic, { mimeType: mime, audioBitsPerSecond: 64_000 });
      recorder.current = next;
      const chunks: Blob[] = [];
      let bytes = 0;
      let tooLarge = false;
      let recorderFailed = false;
      const started = performance.now();
      next.ondataavailable = (event) => {
        if (!event.data.size || tooLarge) return;
        bytes += event.data.size;
        if (bytes > MAX_BYTES) {
          tooLarge = true;
          if (next.state !== "inactive") next.stop();
        } else chunks.push(event.data);
      };
      next.onerror = () => {
        recorderFailed = true;
        releaseMedia();
        if (generation.current === activeGeneration) {
          setState("idle");
          setError("The microphone stopped working. Try again or type your answer.");
        }
      };
      next.onstop = async () => {
        releaseMedia();
        recorder.current = null;
        if (generation.current !== activeGeneration || recorderFailed) return;
        if (tooLarge) {
          setState("idle");
          setError("That recording was too large. Try a shorter answer or type it below.");
          return;
        }
        const type = next.mimeType || chunks[0]?.type || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size < 100) {
          setState("idle");
          setError("No audio was recorded. Try again or type your answer.");
          return;
        }
        setState("transcribing");
        const controller = new AbortController();
        request.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 35_000);
        try {
          const body = new FormData();
          body.set("audio", blob, type.includes("mp4") ? "answer.mp4" : "answer.webm");
          body.set("sessionId", sessionId);
          body.set("attempt", String(attempt));
          const response = await fetch("/api/transcribe", { method: "POST", body, signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || "We couldn’t transcribe that answer. Please try again.");
          if (generation.current !== activeGeneration) return;
          if (typeof data.text !== "string" || !data.text.trim()) throw new Error("No clear speech was found. Try again or type your answer.");
          setDraft(data.text);
          recorded.current = {
            text: data.text,
            durationMs: typeof data.audioDurationMs === "number" && data.audioDurationMs > 0 ? data.audioDurationMs : null,
          };
          setNotice("Review the transcript, then send your answer. Editing it excludes this answer from pace estimates.");
        } catch (failure) {
          if (generation.current === activeGeneration) setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "Transcription timed out. Try again or type your answer.");
        } finally {
          clearTimeout(timeout);
          if (generation.current === activeGeneration) { request.current = null; setState("idle"); }
        }
      };
      try {
        // Read-only tap for the waveform and the manager's listening state. It never touches what is recorded.
        const context = new AudioContext();
        const node = context.createAnalyser();
        node.fftSize = 1024;
        context.createMediaStreamSource(mic).connect(node);
        void context.resume().catch(() => undefined);
        meter.current = context;
        setAnalyser(node);
      } catch { /* Recording works without the level meter. */ }
      next.start(250);
      setElapsed(0);
      setState("recording");
      timer.current = setInterval(() => {
        const seconds = Math.floor((performance.now() - started) / 1000);
        setElapsed(Math.min(seconds, MAX_SECONDS));
        if ((seconds >= MAX_SECONDS || disabledRef.current) && next.state !== "inactive") next.stop();
      }, 250);
    } catch (failure) {
      if (generation.current !== activeGeneration) return;
      releaseMedia();
      setState("idle");
      setVoiceUnavailable(true);
      const denied = failure instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(failure.name);
      setNotice(denied
        ? "Microphone access was denied. Type your answer below, or enable microphone access in your browser and reload."
        : "We couldn’t access a microphone. Type your answer below; the same coaching applies.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || state !== "idle" || !draft.trim()) return;
    setState("sending");
    setError(null);
    const generationAtSend = generation.current;
    try {
      await onSubmit(draft.trim(), recorded.current?.text === draft ? recorded.current.durationMs : null);
      if (generationAtSend === generation.current) { setDraft(""); recorded.current = null; setNotice(null); }
    } catch (failure) {
      if (generationAtSend === generation.current) setError(failure instanceof Error ? failure.message : "Your answer wasn’t sent. Please try again.");
    } finally {
      if (generationAtSend === generation.current) setState("idle");
    }
  }

  const busy = state !== "idle";
  const recording = state === "recording";
  const ring = (
    <svg className="rec-ring" viewBox="0 0 96 96" aria-hidden="true">
      <circle className="rec-track" cx="48" cy="48" r="45.5" />
      {recording && <circle className="rec-clock" cx="48" cy="48" r="45.5" strokeDasharray={RING} strokeDashoffset={RING * (1 - elapsed / MAX_SECONDS)} />}
    </svg>
  );
  const recordButton = "flex flex-col items-center gap-1 rounded-lg px-2 pb-1 text-sm font-semibold disabled:text-neutral-500";

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Your answer">
      <div className={cx("flex flex-col-reverse items-center gap-3 sm:flex-row sm:gap-6", voiceUnavailable && "hidden")}>
        <div className="flex shrink-0 items-center gap-3">
          {!voiceUnavailable && (recording ? (
            <button type="button" className={recordButton} onClick={() => recorder.current?.stop()}>
              <span className="rec" data-state="recording">{ring}<Square aria-hidden="true" className="size-6" fill="currentColor" /></span>
              <span>Stop recording<span className="sr-only"> · {elapsed}s</span></span>
            </button>
          ) : (
            <button type="button" className={recordButton} disabled={disabled || busy} onClick={startRecording}>
              <span className="rec" data-state={busy ? "waiting" : disabled ? "off" : "ready"}>{ring}{state === "transcribing" ? <Ellipsis aria-hidden="true" className="size-8" /> : <Mic aria-hidden="true" className="size-8" />}</span>
              <span className={cx("transition-opacity duration-200", (disabled || busy) && state !== "permission" && "opacity-0")}>{state === "permission" ? "Waiting for microphone…" : "Record an answer"}</span>
            </button>
          ))}
          {state === "permission" && (
            <Button variant="secondary" size="sm" onClick={() => {
              generation.current++;
              setState("idle");
              setNotice("You can type your answer while microphone access is unavailable.");
              answerField.current?.focus();
            }}><Keyboard aria-hidden="true" className="size-4" />Use text instead</Button>
          )}
        </div>
        <div className="flex min-h-10 w-full min-w-0 flex-1 items-center">
          {recording && <div aria-hidden="true" className="flex w-full items-center gap-4">
            <Waveform analyser={analyser} className="min-w-0 flex-1" />
            <p className="figure shrink-0 text-xl">{clock(elapsed)}<span className="ml-1 font-sans text-sm font-normal tracking-normal text-neutral-500">/ {clock(MAX_SECONDS)}</span></p>
          </div>}
          <p className={recording ? "sr-only" : "w-full text-center text-sm text-neutral-500 sm:text-left"} role="status" aria-live="polite">
            {recording ? `Recording. Maximum ${MAX_SECONDS} seconds.` : state === "transcribing" ? "Transcribing your answer…" : state === "sending" ? "Sending your answer…" : disabled && waitingHint ? waitingHint : "Voice or text. Your choice."}
          </p>
        </div>
      </div>
      {notice && (voiceUnavailable
        ? <Notice tone="warning" icon={MicOff} title="Carry on by typing.">{notice}</Notice>
        : <Notice>{notice}</Notice>)}
      {voiceUnavailable && !notice && <p className="flex items-center gap-2 text-sm text-neutral-500"><MicOff aria-hidden="true" className="size-4 shrink-0" />Voice is off for now. Enable the microphone in your browser and reload to record.</p>}
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      <div>
        <label htmlFor="answer-draft" className="mb-2 block text-sm font-semibold">Your answer</label>
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <textarea ref={answerField} id="answer-draft" className="field max-h-56 resize-none [field-sizing:content]" rows={draft || voiceUnavailable ? 4 : 1} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={3000} disabled={disabled || busy} placeholder={state === "transcribing" ? "" : voiceUnavailable ? "Say what you would say in the real conversation…" : "Or type what you’d say…"} aria-describedby="answer-help" />
            {state === "transcribing" && <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-1/2 flex -translate-y-1/2 gap-2"><Skeleton className="h-3 flex-[3]" /><Skeleton className="h-3 flex-[2]" /><Skeleton className="h-3 flex-1" /></div>}
          </div>
          <Button type="submit" className="shrink-0" disabled={disabled || busy || !draft.trim()}><Send aria-hidden="true" className="size-4 max-sm:hidden" />{state === "sending" ? "Sending…" : "Send answer"}</Button>
        </div>
        <p id="answer-help" className="mt-2 text-xs text-neutral-500"><span className="tabular">{draft.length.toLocaleString()} / 3,000</span> characters. Audio is transcribed, not saved in your practice history.</p>
      </div>
    </form>
  );
}
