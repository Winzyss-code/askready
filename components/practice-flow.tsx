"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, CircleAlert, FlaskConical, Square, Timer, Volume2 } from "lucide-react";
import { getPersona, personasFor, sampleLine } from "@/config/personas";
import { rubric } from "@/config/rubric";
import type { Scenario } from "@/config/scenarios";
import { api, ClientError, ensureClientAuth, errorMessage, reportTiming, streamApi, type StreamEvent } from "@/lib/client";
import { coachingStepLabels, type CoachingStep } from "@/lib/coaching-steps";
import { cx } from "@/lib/cx";
import type { Feedback, Focus, Session, SessionBundle, Setup, Turn } from "@/types/domain";
import { LessonCard } from "@/components/lesson-card";
import { Character, type CharacterEmotion, type CharacterState } from "@/components/Character";
import type { Emotion } from "@/lib/emotion";
import { DailyLimit, useProgress } from "@/components/progress-panel";
import { SetupForm } from "@/components/setup-form";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { VoiceComposer, type ComposerState } from "@/components/voice-composer";
import { useSpeech } from "@/hooks/use-speech";
import { useMouthSync } from "@/lib/useMouthSync";

function Transcript({ turns, manager, empty, focus }: { turns: Turn[]; manager: string; empty: string; focus?: Focus }) {
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
              <li key={turn.id} className={cx("ml-8 rounded-md bg-neutral-100 p-3 text-sm", turn.id === focus?.answerTurnId && "shadow-[inset_3px_0_0_var(--color-marker)]")}>
                <p className="mb-1 text-xs font-semibold text-neutral-600">You{turn.id === focus?.answerTurnId && <span className="font-normal"> · the answer to retry</span>}</p>
                <p className="whitespace-pre-wrap break-words">{turn.text}</p>
              </li>
            ) : (
              <li key={turn.id} className="mr-8 flex gap-3 text-sm">
                <span aria-hidden="true" className={cx("mt-1 size-2 shrink-0 rounded-full", turn.id === focus?.objectionTurnId ? "bg-marker outline outline-1 outline-ink" : "bg-ink")} />
                <div className="min-w-0">
                  <p className="mb-1 text-xs font-semibold">{manager}{turn.id === focus?.objectionTurnId && <span className="ml-2 rounded-sm bg-marker px-1.5 py-0.5 text-ink">Hardest moment</span>}</p>
                  <p className={cx("whitespace-pre-wrap break-words", turn.id === focus?.objectionTurnId ? "text-ink" : "text-neutral-600")}>{turn.text}</p>
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

/** The steps the coach has reached so far; the last one is in progress. Nothing is shown before it happens. */
function CoachingProgress({ steps }: { steps: CoachingStep[] }) {
  return (
    <div className="border-t border-neutral-200 pt-6" aria-busy="true">
      <h2 className="font-semibold">Your coach is working</h2>
      <ol className="mt-4 space-y-3" aria-live="polite">
        {steps.map((step, index) => {
          const current = index === steps.length - 1;
          return (
            <li key={step} className={cx("flex items-start gap-3 animate-settle", current ? "text-ink" : "text-neutral-500")}>
              <span aria-hidden="true" className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", current ? "border-2 border-ink border-t-transparent motion-safe:animate-spin" : "bg-ink text-paper")}>{!current && <Check className="size-3" strokeWidth={3} />}</span>
              <span>{coachingStepLabels[step]}{current ? "…" : ""}<span className="sr-only">{current ? " (in progress)" : " (done)"}</span></span>
            </li>
          );
        })}
        {steps.length === 0 && <li className="text-neutral-500">Sending your conversation…</li>}
      </ol>
    </div>
  );
}

/** One thing to try in the retry: the coach's rewrite of this answer, or the exercise for its weakest skill. */
function retryTip(feedback: Feedback, focus: Focus) {
  const rewrite = feedback.improvements.find((improvement) => focus.answer.includes(improvement.quote));
  if (rewrite) return { kind: "rewrite" as const, text: rewrite.rewrite };
  const weakest = rubric.reduce((low, item) => focus.baselineScores[item.id].score < focus.baselineScores[low.id].score ? item : low);
  return { kind: "exercise" as const, text: weakest.exercise };
}

const audioFrom = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;

export function PracticeFlow({ scenario, initialSessionId, retryRequested, exampleRequested = false }: { scenario: Scenario; initialSessionId?: string; retryRequested: boolean; exampleRequested?: boolean }) {
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
  const [composerTrouble, setComposerTrouble] = useState(false);
  // The mood the model gave each fresh reply, by turn id. Saved replies carry their own (once migration 003 is applied).
  const [moods, setMoods] = useState<Record<string, Emotion>>({});
  // The reply while it is still arriving: its mood as soon as it's known, then its words.
  const [live, setLive] = useState<{ text: string; emotion: Emotion | null } | null>(null);
  const [steps, setSteps] = useState<CoachingStep[]>([]);
  const [example, setExample] = useState(exampleRequested && Boolean(scenario.example));
  const [setupPersona, setSetupPersona] = useState(() => personasFor(scenario)[0]?.id ?? "");
  const [meter, setMeter] = useState<AnalyserNode | null>(null);
  const loadedId = useRef<string | null>(null);
  const operation = useRef<{ payload: string; id: string } | null>(null);
  const lastSpoken = useRef<string | null>(null);
  const counterpart = scenario.counterpart.label.toLowerCase();
  // Speech hands each reply's audio to the mouth, and the mouth needs to know when speech is sounding: forward through a ref.
  const followAudio = useRef<((player: HTMLAudioElement, data: ArrayBuffer) => void) | null>(null);
  const forwardAudio = useCallback((player: HTMLAudioElement, data: ArrayBuffer) => followAudio.current?.(player, data), []);
  const speech = useSpeech(bundle?.session.id ?? "", counterpart, forwardAudio);
  const { speak, stop, isSpeaking, voice, notice } = speech;
  // The mouth moves only while a voice is actually sounding, not while the audio is still loading.
  const { mouth, follow } = useMouthSync(isSpeaking && (voice === "tts" || voice === "browser"));
  useEffect(() => { followAudio.current = follow; }, [follow]);
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

  function accept(saved: SessionBundle) {
    const reaction = saved.reaction;
    if (reaction) setMoods((current) => ({ ...current, [reaction.turnId]: reaction.emotion }));
    setBundle(saved);
  }

  /**
   * Sends a turn and plays the reply while it arrives: the mood as soon as it's known, the words as they're written,
   * and each sentence's voice as soon as that sentence is ready. Resolves once the exchange is saved.
   */
  async function talk(body: Record<string, unknown>) {
    const sentAt = performance.now();
    const sentences: string[] = [];
    let heard = false;
    const playback = speech.stream();
    setLive({ text: "", emotion: null });
    const onEvent = (event: StreamEvent) => {
      if (event.type === "emotion") setLive((current) => current && { ...current, emotion: event.emotion as Emotion });
      else if (event.type === "text") setLive((current) => current && { ...current, text: current.text + String(event.text) });
      else if (event.type === "sentence") sentences[Number(event.index)] = String(event.text);
      else if (event.type === "audio") {
        const index = Number(event.index);
        const data = typeof event.data === "string" ? audioFrom(event.data) : null;
        if (data && !heard) { heard = true; reportTiming("client_reply_first_audio", performance.now() - sentAt); }
        playback.push({ data, text: sentences[index] ?? String(event.text ?? "") });
      }
    };
    try {
      const saved = await streamApi<SessionBundle>("/api/turn", body, onEvent, { onClose: () => playback.end() });
      // The reply was already spoken as it streamed; don't fetch its audio again.
      const latest = saved.turns.filter((turn) => turn.role === "assistant" && turn.attempt === 0).sort((a, b) => b.sequence - a.sequence)[0];
      if (latest && sentences.length) lastSpoken.current = latest.id;
      return saved;
    } catch (err) {
      stop(); // An unsaved reply shouldn't keep talking.
      throw err;
    } finally { setLive(null); }
  }

  async function start(setup: Setup, personaId: string) {
    if (busy) return;
    setBusy("starting"); setError(null); stop();
    const body = { action: "start", scenarioId: scenario.id, personaId, setup };
    try {
      const saved = await talk({ ...body, requestId: requestId(body) });
      loadedId.current = saved.session.id;
      accept(saved);
      operation.current = null;
      router.replace(`/practice/${scenario.id}?session=${saved.session.id}`, { scroll: false });
      // Starting from the form leaves the page scrolled far down; the counterpart and its first words are at the top.
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorMessage(err));
      // The server is the source of truth. If it says the day is used, reload so the limit card replaces the form.
      if (err instanceof ClientError && err.code === "DAILY_LIMIT") reloadProgress();
    }
    finally { setBusy(null); }
  }

  const getFeedback = useCallback(async (sessionId: string, attempt: 0 | 1) => {
    setBusy("feedback"); setError(null); stop(); setSteps([]);
    const startedAt = performance.now();
    try {
      const saved = await streamApi<SessionBundle>("/api/feedback", { sessionId, attempt }, (event) => {
        if (event.type === "step") setSteps((current) => current.includes(event.step as CoachingStep) ? current : [...current, event.step as CoachingStep]);
      });
      reportTiming("client_coaching_total", performance.now() - startedAt);
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
      // A retry gets no reply, so there is nothing to stream.
      saved = isRetry ? await api<SessionBundle>("/api/turn", { ...body, requestId: requestId(body) }) : await talk({ ...body, requestId: requestId(body) });
      accept(saved);
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
  const persona = getPersona(setupPersona);

  if (!bundle) return (
    <main id="main" className="shell pb-16 pt-6 lg:pt-12">
      <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-8">
          <h1 className="display text-2xl lg:text-3xl">{scenario.title}</h1>
          <p className="mt-4 text-lg text-neutral-600">{scenario.description}</p>
          <p className="mt-3 max-w-measure text-neutral-500">Read the technique, answer five short questions, then talk it through with an AI {counterpart}. Coaching comes after you finish, not while you speak.</p>
          {persona && <figure className="mt-8 flex items-start gap-4">
            <Character state="idle" emotion={error ? "concerned" : persona.emotions[0]} persona={setupPersona} size="md" />
            <div className="min-w-0 pt-1">
              <figcaption className="text-sm font-semibold">{persona.name}<span className="font-normal text-neutral-500"> · {scenario.counterpart.label}</span></figcaption>
              <blockquote key={setupPersona} className="mt-1 text-lg font-medium leading-snug animate-settle">“{sampleLine(persona, scenario.id)}”</blockquote>
              <p className="mt-1 text-xs text-neutral-500">The kind of thing they say. Yours will answer your actual case.</p>
            </div>
          </figure>}
          {scenario.example && !progressLoading && !limited && <Card as="section" className="mt-8 p-5" aria-label="Quick start">
            {example ? <>
              <p className="flex items-center gap-2 font-semibold"><FlaskConical aria-hidden="true" className="size-4" />Example case loaded</p>
              <p className="mt-2 text-sm text-neutral-600">A made-up case, clearly not yours: “{scenario.example.desiredRaise}”, met with “{scenario.example.objection}” It’s filled in below, so you can change anything first.</p>
              {error && <Notice tone="error" role="alert" className="mt-4">{error}</Notice>}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button disabled={busy !== null} onClick={() => void start(scenario.example!, setupPersona)}>{busy === "starting" ? "Preparing your conversation…" : <>Start with this example<ArrowRight aria-hidden="true" className="size-4" /></>}</Button>
                <a href="#setup" className="link flex min-h-11 items-center text-sm">Edit it first</a>
              </div>
            </> : <>
              <h2 className="font-semibold">Short on time?</h2>
              <p className="mt-1 text-sm text-neutral-600">Start from a made-up example and be talking in seconds. You can edit it first.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setExample(true)}><FlaskConical aria-hidden="true" className="size-4" />Use an example case</Button>
            </>}
          </Card>}
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
            <h2 id="setup" className="display mb-8 flex scroll-mt-6 flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink pt-8 text-xl">Set up your rehearsal{example && <Badge tone="marker">Example case · edit anything</Badge>}</h2>
            {error && !example && <Notice tone="error" role="alert" className="mb-8">{error}</Notice>}
            <SetupForm key={example ? "example" : "blank"} scenario={scenario} defaults={example ? scenario.example : undefined} disabled={busy !== null} onStart={start} onPersonaChange={setSetupPersona} />
          </>}
        </div>
      </div>
    </main>
  );

  const finished = Boolean(initialFeedback && !isRetry);
  const canAnswer = !initialFeedback && userCount < 6 || isRetry && userCount === 0;
  const recording = composerState === "recording";
  // Thinking starts the moment a recording ends, through transcription and sending, until the reply arrives.
  // Speaking needs a voice that is actually sounding; while the audio loads the character just shows its reaction.
  // A streamed reply shows its mood as soon as the tag arrives, before any words.
  const aloud = isSpeaking && (voice === "tts" || voice === "browser");
  const waiting = busy !== null || composerState === "transcribing" || composerState === "sending";
  const managerState: CharacterState = recording ? "listening" : aloud ? "speaking" : waiting && !live?.emotion ? "thinking" : "idle";
  // The mood comes only from the model's tag on the reply, never from judging the user. Errors look concerned;
  // text-only playback stays neutral.
  const managerEmotion: CharacterEmotion = error || composerTrouble ? "concerned"
    : live ? live.emotion ?? "neutral"
    : managerState === "thinking" || voice === "none" ? "neutral"
    : moods[spokenTurn?.id ?? ""] ?? spokenTurn?.emotion ?? "neutral";
  const stateLabel = busy === "feedback" ? "Reviewing your words and preparing specific coaching…"
    : aloud ? "Speaking"
    : busy === "replying" ? (live?.text ? `${manager} is replying…` : `${manager} is thinking…`)
    : busy === "starting" ? "Preparing your conversation…"
    : recording ? "Listening"
    : isSpeaking ? "Speaking"
    : canAnswer ? "Your turn"
    : isRetry ? "Retry saved" : finished ? "Coaching ready" : "Six answers in";
  const line = isRetry ? focus?.objection : lastManager?.text;
  const tip = isRetry && focus && initialFeedback ? retryTip(initialFeedback, focus) : null;
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
              <Character state={managerState} emotion={managerEmotion} mouthOpen={mouth} analyser={meter} persona={bundle.session.persona_id} size="md" className="lg:[--char:7rem]" label={`${manager}, ${stateLabel.toLowerCase()}`} />
              <div className="min-w-0">
                <h2 className="font-semibold">{isRetry ? `${manager} said` : <>{manager}<span className="font-normal text-neutral-500"> · {scenario.counterpart.label}</span></>}</h2>
                <p role="status" aria-live="polite" className="text-sm text-neutral-500">{stateLabel}</p>
              </div>
            </div>
            {live?.text ? <blockquote className="mt-6 whitespace-pre-wrap break-words text-lg font-medium lg:mt-8 lg:text-xl lg:leading-snug">{live.text}</blockquote>
              : busy === "replying" ? <div aria-hidden="true" className="mt-8 space-y-3">
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

          {canAnswer && busy !== "feedback" ? (
            <div className="-mx-4 mt-8 border-t border-neutral-200 bg-paper px-4 pb-4 pt-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-10 lg:px-0 lg:pt-6 max-lg:[@media(min-height:44rem)]:sticky max-lg:[@media(min-height:44rem)]:bottom-0">
              {tip && <p className={cx("mb-4 max-w-measure text-sm", recede)}><span className="font-semibold">Try: </span>{tip.kind === "rewrite" ? <span className="mark">“{tip.text}”</span> : tip.text}</p>}
              <VoiceComposer key={`${bundle.session.id}:${isRetry ? 1 : 0}`} onSubmit={reply} onBusyChange={setComposerBusy} onStateChange={setComposerState} onMeter={setMeter} onTroubleChange={setComposerTrouble} disabled={busy !== null || isSpeaking} waitingHint={isSpeaking ? `${manager} is speaking. Answer when they finish, or stop playback.` : null} sessionId={bundle.session.id} attempt={isRetry ? 1 : 0} />
            </div>
          ) : null}

          {busy === "feedback" ? <div className="mt-8"><CoachingProgress steps={steps} /></div>
          : finished ? <div className="mt-8">
            <ButtonLink href={`/results/${bundle.session.id}`}>{retryFeedback ? "See your comparison" : "See your coaching"}<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
          </div> : isRetry && userCount > 0 ? <div className="mt-8">
            <p className="mb-4 text-neutral-600">Your retry is saved. Compare it with your original answer to this exact objection.</p>
            <Button disabled={busy !== null} onClick={() => void getFeedback(bundle.session.id, 1)}>Compare my answers</Button>
          </div> : !isRetry && <div className={cx("mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-6", recede)}>
            <Button variant={userCount >= 6 ? "primary" : "secondary"} disabled={busy !== null || composerBusy || userCount < 2} onClick={() => void getFeedback(bundle.session.id, 0)}>Finish & get coaching</Button>
            <p className="min-w-0 flex-1 basis-64 text-sm text-neutral-500">{userCount < 2 ? "Answer at least twice so there’s a real objection to work on." : userCount >= 6 ? "You’ve reached six answers. It’s time to review and retry your hardest moment." : "Ready when you are. Two to six answers is enough for a focused rehearsal."}</p>
          </div>}
          <p className={cx("mt-6 text-xs text-neutral-500", recede)}>Saved to your account in this browser. You can return using this page’s URL, or <Link className="link" href="/progress#account">save your progress to an email</Link> to keep it on any device.</p>
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
          <Transcript turns={currentTurns} manager={manager} focus={finished ? focus ?? undefined : undefined} empty={isRetry ? "Your new answer will appear here." : "The conversation will appear here."} />
        </aside>
      </div>
    </main>
  );
}
