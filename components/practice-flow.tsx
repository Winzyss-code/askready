"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, CircleAlert, Square, Timer, Volume2 } from "lucide-react";
import { getPersona } from "@/config/personas";
import type { Scenario } from "@/config/scenarios";
import { api, ClientError, ensureClientAuth, errorMessage } from "@/lib/client";
import { cx } from "@/lib/cx";
import type { Session, SessionBundle, Setup, Turn } from "@/types/domain";
import { LessonCard } from "@/components/lesson-card";
import { Character, type CharacterState } from "@/components/Character";
import { DailyLimit, useProgress } from "@/components/progress-panel";
import { SetupForm } from "@/components/setup-form";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { VoiceComposer, type ComposerState } from "@/components/voice-composer";
import { useSpeech } from "@/hooks/use-speech";
import { useMouthSync } from "@/lib/useMouthSync";

function Transcript({ turns, manager, empty }: { turns: Turn[]; manager: string; empty: string }) {
  const [open, setOpen] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns.length, open]);

  return (
    <section aria-label="Transcript">
      <h2>
        <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm font-semibold" aria-expanded={open} aria-controls="transcript" onClick={() => setOpen((value) => !value)}>
          <span>Transcript <span className="tabular ml-1 text-sm font-normal text-neutral-500">{turns.length} {turns.length === 1 ? "line" : "lines"}</span></span>
          <ChevronDown aria-hidden="true" className={cx("size-5 transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      <div id="transcript" ref={scroller} hidden={!open} className="mt-2 lg:max-h-96 lg:overflow-y-auto lg:pr-2">
        {turns.length === 0 ? <p className="rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">{empty}</p> : (
          <ol className="space-y-3" aria-label="Conversation transcript">
            {turns.map((turn) => turn.role === "user" ? (
              <li key={turn.id} className="ml-8 rounded-md bg-neutral-100 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-neutral-600">You</p>
                <p className="whitespace-pre-wrap break-words">{turn.text}</p>
              </li>
            ) : (
              <li key={turn.id} className="mr-8 flex gap-3 text-sm">
                <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-ink" />
                <div className="min-w-0">
                  <p className="mb-1 text-xs font-semibold">{manager}</p>
                  <p className="whitespace-pre-wrap break-words text-neutral-600">{turn.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function SittingClock() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(tick);
  }, []);
  return (
    <p className="flex items-center gap-1 text-sm text-neutral-600">
      <Timer aria-hidden="true" className="size-4" />
      <span className="sr-only">Time in this sitting: </span>
      <span className="tabular">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
    </p>
  );
}

export function PracticeFlow({ scenario, initialSessionId, retryRequested }: { scenario: Scenario; initialSessionId?: string; retryRequested: boolean }) {
  const router = useRouter();
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [recent, setRecent] = useState<Session[]>([]);
  const [booting, setBooting] = useState(true);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"starting" | "replying" | "feedback" | null>(null);
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerState, setComposerState] = useState<ComposerState>("idle");
  const [meter, setMeter] = useState<AnalyserNode | null>(null);
  const loadedId = useRef<string | null>(null);
  const operation = useRef<{ payload: string; id: string } | null>(null);
  const lastSpoken = useRef<string | null>(null);
  // Speech needs the mouth's audio hook-up, and the mouth needs to know when speech is sounding: forward through a ref.
  const connectAudio = useRef<((player: HTMLAudioElement) => void) | null>(null);
  const forwardAudio = useCallback((player: HTMLAudioElement) => connectAudio.current?.(player), []);
  const { speak, stop, isSpeaking, voice, notice } = useSpeech(bundle?.session.id ?? "", forwardAudio);
  // The mouth moves only while a voice is actually sounding, not while the audio is still loading.
  const { mouth, connect } = useMouthSync(isSpeaking && (voice === "tts" || voice === "browser"));
  useEffect(() => { connectAudio.current = connect; }, [connect]);
  // Only the setup stage needs to know whether today's free session is used.
  const { progress, loading: progressLoading, retry: reloadProgress } = useProgress(!initialSessionId);

  useEffect(() => {
    if (initialSessionId && loadedId.current === initialSessionId) return;
    const controller = new AbortController();
    let active = true;
    let leaving = false;
    async function load() {
      try {
        await ensureClientAuth();
        if (initialSessionId) {
          const saved = await api<SessionBundle>(`/api/sessions/${encodeURIComponent(initialSessionId)}`, undefined, { signal: controller.signal });
          if (saved.session.scenario_id !== scenario.id) {
            // A saved session opened under the wrong scenario goes to its own page.
            leaving = true;
            if (active) router.replace(`/practice/${saved.session.scenario_id}?session=${saved.session.id}${retryRequested ? "&retry=1" : ""}`);
            return;
          }
          if (active) { loadedId.current = saved.session.id; setBundle(saved); }
        } else {
          const saved = await api<{ sessions: Session[] }>(`/api/sessions?scenarioId=${encodeURIComponent(scenario.id)}`, undefined, { signal: controller.signal });
          if (active) setRecent(saved.sessions);
        }
        if (active) setBootError(null);
      } catch (err) {
        if (active) setBootError(errorMessage(err));
      } finally {
        if (active && !leaving) setBooting(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [initialSessionId, scenario.id, bootAttempt, retryRequested, router]);

  const initialFeedback = bundle?.feedback.find((entry) => entry.attempt === 0);
  const retryFeedback = bundle?.feedback.find((entry) => entry.attempt === 1);
  const focus = initialFeedback?.focus;
  const isRetry = Boolean(focus && retryRequested && !retryFeedback);
  const currentTurns = bundle?.turns.filter((turn) => turn.attempt === (isRetry ? 1 : 0)) ?? [];
  const userCount = currentTurns.filter((turn) => turn.role === "user").length;
  const originalCount = bundle?.turns.filter((turn) => turn.attempt === 0 && turn.role === "user").length ?? 0;
  const lastManager = [...currentTurns].reverse().find((turn) => turn.role === "assistant");
  const retryObjection = isRetry && focus ? bundle?.turns.find((turn) => turn.id === focus.objectionTurnId) : undefined;
  const spokenTurn = isRetry ? retryObjection : lastManager;
  const counterpart = scenario.counterpart.label.toLowerCase();
  const manager = getPersona(bundle?.session.persona_id ?? "")?.name ?? `Your ${counterpart}`;

  useEffect(() => {
    if (!spokenTurn || lastSpoken.current === spokenTurn.id || initialFeedback && !isRetry) return;
    lastSpoken.current = spokenTurn.id;
    void speak(spokenTurn);
  }, [spokenTurn, speak, initialFeedback, isRetry]);

  function requestId(payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    if (operation.current?.payload !== fingerprint) operation.current = { payload: fingerprint, id: crypto.randomUUID() };
    return operation.current.id;
  }

  async function start(setup: Setup, personaId: string) {
    if (busy) return;
    setBusy("starting"); setError(null); stop();
    const body = { action: "start", scenarioId: scenario.id, personaId, setup };
    try {
      const saved = await api<SessionBundle>("/api/turn", { ...body, requestId: requestId(body) });
      loadedId.current = saved.session.id;
      setBundle(saved);
      operation.current = null;
      router.replace(`/practice/${scenario.id}?session=${saved.session.id}`, { scroll: false });
    } catch (err) {
      setError(errorMessage(err));
      // The server is the source of truth. If it says the day is used, reload so the limit card replaces the form.
      if (err instanceof ClientError && err.code === "DAILY_LIMIT") reloadProgress();
    }
    finally { setBusy(null); }
  }

  const getFeedback = useCallback(async (sessionId: string, attempt: 0 | 1) => {
    setBusy("feedback"); setError(null); stop();
    try {
      const saved = await api<SessionBundle>("/api/feedback", { sessionId, attempt });
      setBundle(saved);
      router.push(`/results/${sessionId}`);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  }, [router, stop]);

  async function reply(text: string, audioDurationMs: number | null) {
    if (!bundle || busy) return;
    setBusy("replying"); setError(null); stop();
    const body = { action: "reply", sessionId: bundle.session.id, text, audioDurationMs, attempt: isRetry ? 1 : 0 };
    let saved: SessionBundle;
    try {
      saved = await api<SessionBundle>("/api/turn", { ...body, requestId: requestId(body) });
      setBundle(saved);
      operation.current = null;
    } catch (err) {
      setError(errorMessage(err));
      throw err; // Composer retains the draft until the turn is actually saved.
    } finally { setBusy(null); }
    if (isRetry) await getFeedback(saved.session.id, 1);
  }

  const strip = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-neutral-200 py-3";

  if (booting || bootError) return (
    <main id="main" className="shell pb-16">
      <div className={strip}><h1 className="display text-lg">{scenario.title}</h1></div>
      {booting ? <div className="pt-8 lg:pt-12">
        <p role="status" className="text-sm text-neutral-500">Opening your private practice space…</p>
        <div aria-hidden="true" className="mt-6 max-w-measure">
          <Skeleton className="size-18 rounded-full" />
          <Skeleton className="mt-8 h-5" /><Skeleton className="mt-3 h-5 w-5/6" /><Skeleton className="mt-3 h-5 w-2/3" />
          <Skeleton className="mt-10 h-12" />
        </div>
      </div> : <div className="max-w-measure pt-8 lg:pt-12">
        <CircleAlert aria-hidden="true" className="size-8 text-error" />
        <h2 className="display mt-4 text-xl">We couldn’t open your practice space.</h2>
        <p role="alert" className="mt-3 text-neutral-600">{bootError}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button onClick={() => { setBooting(true); setBootError(null); setBootAttempt((value) => value + 1); }}>Try connecting again</Button>
          <Link href="/" className="link flex min-h-11 items-center">Return home</Link>
        </div>
      </div>}
    </main>
  );

  // A hint only: if progress can't load, the form shows and the server still enforces the limit.
  const limited = Boolean(progress?.today.used);

  if (!bundle) return (
    <main id="main" className="shell pb-16 pt-6 lg:pt-12">
      <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-8">
          <h1 className="display text-2xl lg:text-3xl">{scenario.title}</h1>
          <p className="mt-4 text-lg text-neutral-600">{scenario.description}</p>
          <p className="mt-3 max-w-measure text-neutral-500">Read the technique, answer five short questions, then talk it through with an AI {counterpart}. Coaching comes after you finish, not while you speak.</p>
          {recent.length > 0 && !(limited && recent[0].id === progress?.today.sessionId) && <Card as="section" className="mt-8 p-5" aria-label="Previous practice">
            <h2 className="font-semibold">Pick up where you left off</h2>
            <p className="mt-1 text-sm text-neutral-500">Your latest session · {new Date(recent[0].created_at).toLocaleDateString()}</p>
            <ButtonLink variant="secondary" size="sm" className="mt-4" href={recent[0].status === "practice" ? `/practice/${scenario.id}?session=${recent[0].id}` : `/results/${recent[0].id}`}>{recent[0].status === "practice" ? "Resume rehearsal" : "View saved coaching"}<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
          </Card>}
        </div>
        <div className="min-w-0">
          {scenario.lesson && <LessonCard lesson={scenario.lesson} className="mb-12" />}
          {progressLoading ? <div className="border-t border-ink pt-8" aria-busy="true">
            <p role="status" className="text-sm text-neutral-500">Checking today’s session…</p>
            <Skeleton className="mt-6 h-12" /><Skeleton className="mt-4 h-12" />
          </div> : limited && progress ? <DailyLimit progress={progress} scenario={scenario} /> : <>
            <h2 className="display mb-8 border-t border-ink pt-8 text-xl">Set up your rehearsal</h2>
            {error && <Notice tone="error" role="alert" className="mb-8">{error}</Notice>}
            <SetupForm scenario={scenario} disabled={busy !== null} onStart={start} />
          </>}
        </div>
      </div>
    </main>
  );

  const finished = Boolean(initialFeedback && !isRetry);
  const canAnswer = !initialFeedback && userCount < 6 || isRetry && userCount === 0;
  const recording = composerState === "recording";
  const managerState: CharacterState = busy !== null ? "thinking" : recording ? "listening" : isSpeaking ? "speaking" : "idle";
  const stateLabel = busy === "feedback" ? "Reviewing your words and preparing specific coaching…"
    : busy === "replying" ? `${manager} is thinking…`
    : busy === "starting" ? "Preparing your conversation…"
    : recording ? "Listening"
    : isSpeaking ? "Speaking"
    : canAnswer ? "Your turn"
    : isRetry ? "Retry saved" : finished ? "Coaching ready" : "Six answers in";
  const line = isRetry ? focus?.objection : lastManager?.text;
  // While you record, everything except the manager and the recorder steps back.
  const recede = cx("transition-opacity duration-200", recording && "opacity-50");

  return (
    <main id="main" className="shell pb-16">
      <div className={cx(strip, recede)}>
        <h1 className="display text-lg">{isRetry ? "Try that moment again." : scenario.title}</h1>
        <div className="flex shrink-0 items-center gap-4">
          {isRetry ? <Badge tone="marker">Focused retry</Badge> : (
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <span aria-hidden="true" className="flex gap-1">
                {Array.from({ length: 6 }, (_, index) => <span key={index} className={cx("h-1.5 w-2 rounded-full sm:w-4", index < originalCount ? "bg-ink" : "bg-neutral-300")} />)}
              </span>
              <span className="tabular">{`${originalCount} of 6 answers`}</span>
            </p>
          )}
          <SittingClock />
        </div>
      </div>

      <div className="grid items-start gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {isRetry && <p className="mt-3 text-sm text-neutral-500">Same objection. Same rubric. A new answer in your own words.</p>}
          {error && <Notice tone="error" role="alert" className="mt-6">{error}</Notice>}

          <section className="pt-8 lg:pt-10" aria-label={isRetry ? "The same objection" : `Your ${counterpart}`}>
            <div className="flex items-center gap-4 lg:gap-6">
              <Character state={managerState} mouthOpen={mouth} analyser={meter} persona={bundle.session.persona_id} size="md" className="lg:[--char:7rem]" label={`${manager}, ${stateLabel.toLowerCase()}`} />
              <div className="min-w-0">
                <h2 className="font-semibold">{isRetry ? `${manager} said` : <>{manager}<span className="font-normal text-neutral-500"> · {scenario.counterpart.label}</span></>}</h2>
                <p role="status" aria-live="polite" className="text-sm text-neutral-500">{stateLabel}</p>
              </div>
            </div>
            {busy === "replying" ? <div aria-hidden="true" className="mt-8 space-y-3">
              <Skeleton className="h-5" /><Skeleton className="h-5 w-5/6" /><Skeleton className="h-5 w-1/2" />
            </div> : line && <blockquote className="mt-6 whitespace-pre-wrap break-words text-lg font-medium lg:mt-8 lg:text-xl lg:leading-snug">{isRetry ? `“${line}”` : line}</blockquote>}
            {spokenTurn && <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant="secondary" size="sm" disabled={busy !== null || composerBusy} onClick={() => { if (isSpeaking) stop(); else void speak(spokenTurn); }}>
                {isSpeaking ? <Square aria-hidden="true" className="size-3" fill="currentColor" /> : <Volume2 aria-hidden="true" className="size-4" />}
                {isSpeaking ? "Stop playback" : `Hear the ${counterpart}`}
              </Button>
              <span className="text-xs text-neutral-500">AI-generated voice</span>
            </div>}
            {notice && <p role="status" className="mt-3 text-sm text-neutral-500">{notice}</p>}
            {isRetry && focus && <details className="group mt-6">
              <summary className="link inline-flex min-h-11 items-center gap-1 text-sm">Read your original answer<ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" /></summary>
              <p className="mt-2 max-w-measure whitespace-pre-wrap break-words text-neutral-600">{focus.answer}</p>
            </details>}
          </section>

          {canAnswer ? (
            <div className="-mx-4 mt-8 border-t border-neutral-200 bg-paper px-4 pb-4 pt-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-10 lg:px-0 lg:pt-6 max-lg:[@media(min-height:44rem)]:sticky max-lg:[@media(min-height:44rem)]:bottom-0">
              <VoiceComposer key={`${bundle.session.id}:${isRetry ? 1 : 0}`} onSubmit={reply} onBusyChange={setComposerBusy} onStateChange={setComposerState} onMeter={setMeter} disabled={busy !== null || isSpeaking} waitingHint={isSpeaking ? `${manager} is speaking. Answer when they finish, or stop playback.` : null} sessionId={bundle.session.id} attempt={isRetry ? 1 : 0} />
            </div>
          ) : null}

          {finished ? <div className="mt-8">
            <ButtonLink href={`/results/${bundle.session.id}`}>{retryFeedback ? "See your comparison" : "See your coaching"}<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
          </div> : isRetry && userCount > 0 ? <div className="mt-8">
            <p className="mb-4 text-neutral-600">Your retry is saved. Compare it with your original answer to this exact objection.</p>
            <Button disabled={busy !== null} onClick={() => void getFeedback(bundle.session.id, 1)}>{busy === "feedback" ? "Comparing your answers…" : "Compare my answers"}</Button>
          </div> : !isRetry && <div className={cx("mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6", recede)}>
            <Button variant={userCount >= 6 ? "primary" : "secondary"} disabled={busy !== null || composerBusy || userCount < 2} onClick={() => void getFeedback(bundle.session.id, 0)}>{busy === "feedback" ? "Preparing your coaching…" : "Finish & get coaching"}</Button>
            <p className="min-w-0 flex-1 basis-64 text-sm text-neutral-500">{userCount < 2 ? "Answer at least twice so there’s a real objection to work on." : userCount >= 6 ? "You’ve reached six answers. It’s time to review and retry your hardest moment." : "Ready when you are. Two to six answers is enough for a focused rehearsal."}</p>
          </div>}
          <p className={cx("mt-6 text-xs text-neutral-500", recede)}>Saved to this browser’s anonymous account. You can return using this page’s URL.</p>
        </div>

        <aside className={cx("space-y-8 lg:sticky lg:top-6 lg:pt-10", recede)}>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-neutral-500">Your intention</h2>
            <p className="mt-2 break-words text-lg font-medium"><span className="mark">{bundle.session.setup.desiredRaise}</span></p>
            {scenario.lesson && <div className="mt-4 border-t border-neutral-200 pt-4">
              <h3 className="text-sm font-semibold text-neutral-500">{scenario.lesson.technique}</h3>
              <ol className="mt-2 space-y-1 text-sm">{scenario.lesson.steps.map((step, index) => <li key={step.title} className="flex items-baseline gap-3"><span aria-hidden="true" className="figure text-neutral-400">{index + 1}</span>{step.title}</li>)}</ol>
            </div>}
            <p className="mt-4 text-sm text-neutral-500">Speak as you would in the real conversation. You can use voice or type. Nothing is scored while you talk.</p>
          </Card>
          <Transcript turns={currentTurns} manager={manager} empty={isRetry ? "Your new answer will appear here." : "The conversation will appear here."} />
        </aside>
      </div>
    </main>
  );
}
