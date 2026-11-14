"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, CircleAlert, RotateCcw } from "lucide-react";
import { rubric } from "@/config/rubric";
import { getScenario } from "@/config/scenarios";
import { api, ensureClientAuth, errorMessage } from "@/lib/client";
import type { DeliveryStats, Scores, SessionBundle } from "@/types/domain";
import { ComparisonBoard } from "@/components/comparison-board";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { ScoreBar } from "@/components/ui/score-bar";

function average(scores: Scores) { return Math.round(rubric.reduce((sum, dimension) => sum + scores[dimension.id].score, 0) / rubric.length); }

const sectionTitle = "display text-xl";
const disclosure = "link inline-flex min-h-11 items-center gap-1 text-sm";
const chevron = <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />;

function PhraseCounts({ label, counts }: { label: string; counts: Record<string, number> }) {
  const heard = Object.entries(counts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const total = heard.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="mt-2">
        <p className="figure text-xl">{total}</p>
        {heard.length > 0 ? <ul className="mt-4 space-y-2 text-sm">
          {heard.map(([phrase, count]) => (
            <li key={phrase} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-neutral-600">“{phrase}”</span>
              <span aria-hidden="true" className="flex flex-1 flex-wrap gap-1">{Array.from({ length: Math.min(count, 12) }, (_, index) => <span key={index} className="size-2 rounded-full bg-neutral-400" />)}</span>
              <span className="tabular font-semibold">{count}</span>
            </li>
          ))}
        </ul> : <p className="mt-3 text-sm text-neutral-500">None noticed in this transcript.</p>}
      </dd>
    </div>
  );
}

function Delivery({ stats, isRetry }: { stats: DeliveryStats; isRetry: boolean }) {
  const pace = stats.wordsPerMinute === null ? null : Math.round(stats.wordsPerMinute);
  return (
    <section className="border-t border-neutral-200 pt-10" aria-labelledby="delivery-heading">
      <h2 id="delivery-heading" className={sectionTitle}>Delivery observations</h2>
      <p className="mt-3 max-w-measure text-neutral-600">Observations from your {isRetry ? "retry answer" : "original rehearsal"}, separate from your score. Words like “like” and “just” can be appropriate; these counts aren’t a judgment of confidence.</p>
      <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-3">
        <PhraseCounts label="Potential filler words" counts={stats.fillers} />
        <PhraseCounts label="Hedging phrases" counts={stats.hedges} />
        <div>
          <dt className="text-sm text-neutral-500">Approximate speaking pace</dt>
          <dd className="mt-2">
            {pace === null ? <p className="text-lg font-semibold">Not available</p> : <>
              <p className="figure text-xl">{pace}<span className="ml-1 font-sans text-sm font-normal tracking-normal text-neutral-500">wpm</span></p>
              <div aria-hidden="true" className="mt-5">
                <div className="relative h-2 rounded-full bg-neutral-200"><span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink" style={{ left: `${Math.max(0, Math.min(100, (pace - 60) / 1.8))}%` }} /></div>
                <div className="mt-2 flex justify-between text-xs text-neutral-500"><span>Slower</span><span>Faster</span></div>
              </div>
            </>}
          </dd>
        </div>
      </dl>
      <p className="mt-8 max-w-measure text-sm text-neutral-500">{stats.wordsPerMinute === null ? "Pace is available for recorded answers only. Typed answers have no audio duration." : "Pace uses recorded answers only, including pauses. Transcription may omit fillers, so counts are approximate."}</p>
    </section>
  );
}

function OriginalRehearsal({ scores }: { scores: Scores }) {
  const ranked = [...rubric].sort((a, b) => scores[b.id].score - scores[a.id].score);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  return (
    <section aria-labelledby="scores-heading">
      <h2 id="scores-heading" className={sectionTitle}>Your original rehearsal</h2>
      <div className="mt-6 grid gap-x-16 gap-y-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <p className="figure text-3xl">{average(scores)}<span className="ml-1 font-sans text-base font-normal tracking-normal text-neutral-500">/100</span></p>
          <p className="mt-3 text-sm text-neutral-500">Full-session coaching estimate · Average {average(scores)}/100</p>
          {scores[strongest.id].score > scores[weakest.id].score && <p className="mt-4 text-neutral-600">Strongest on <strong className="font-semibold text-ink">{strongest.label.toLowerCase()}</strong>. Most room in <strong className="font-semibold text-ink">{weakest.label.toLowerCase()}</strong>.</p>}
        </div>
        <div>
          <div className="space-y-5">{rubric.map((dimension) => <ScoreBar key={dimension.id} label={dimension.label} value={scores[dimension.id].score} />)}</div>
          <details className="group mt-6">
            <summary className={disclosure}>Read the reasoning behind each score{chevron}</summary>
            <dl className="mt-2 divide-y divide-neutral-200">{rubric.map((dimension) => {
              const value = scores[dimension.id];
              return <div key={dimension.id} className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="text-sm font-semibold">{dimension.label}<span className="tabular ml-2 font-normal text-neutral-500">{value.score}/100</span></dt><dd className="min-w-0 text-sm">{value.quote && <blockquote className="break-words">“{value.quote}”</blockquote>}<p className="mt-1 text-neutral-500">{value.reason}</p></dd></div>;
            })}</dl>
          </details>
        </div>
      </div>
    </section>
  );
}

export function ResultsView({ sessionId }: { sessionId: string }) {
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        await ensureClientAuth();
        const saved = await api<SessionBundle>(`/api/sessions/${encodeURIComponent(sessionId)}`, undefined, { signal: controller.signal });
        if (active) { setBundle(saved); setError(null); }
      } catch (err) { if (active) setError(errorMessage(err)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [sessionId, attempt]);

  const first = bundle?.feedback.find((entry) => entry.attempt === 0);
  const retry = bundle?.feedback.find((entry) => entry.attempt === 1);
  const focus = first?.focus;
  const latestScores = retry?.scores ?? first?.scores;
  const weakest = latestScores ? [...rubric].sort((a, b) => latestScores[a.id].score - latestScores[b.id].score)[0] : null;
  const scenario = bundle ? getScenario(bundle.session.scenario_id) : undefined;
  const page = "shell pb-8 pt-6 lg:pt-12";

  if (loading || error || !bundle) return (
    <main id="main" className={page}>
      <h1 className="display text-2xl lg:text-3xl">Your coaching</h1>
      {loading ? <>
        <p role="status" className="mt-4 text-neutral-500">Opening your saved session…</p>
        <div aria-hidden="true" className="mt-12 grid gap-x-16 gap-y-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Skeleton className="h-14 w-32" />
          <div className="space-y-6">{[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-4" />)}</div>
        </div>
        <div aria-hidden="true" className="mt-16 space-y-4"><Skeleton className="h-7 w-64" /><Skeleton className="h-40 rounded-md" /><Skeleton className="h-40 rounded-md" /></div>
      </> : <div className="mt-8 max-w-measure">
        <CircleAlert aria-hidden="true" className="size-8 text-error" />
        <p role="alert" className="mt-4 text-neutral-600">{error || "We couldn’t find this session."}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Try again</Button>
          <Link href="/" className="link flex min-h-11 items-center">Return home</Link>
        </div>
      </div>}
    </main>
  );

  if (!first) return (
    <main id="main" className={page}>
      <h1 className="display text-2xl lg:text-3xl">Your rehearsal is saved.</h1>
      <p className="mt-4 max-w-measure text-lg text-neutral-600">Finish your conversation and request coaching to see your results here.</p>
      <ButtonLink className="mt-8" href={`/practice/${bundle.session.scenario_id}?session=${sessionId}`}>Continue rehearsal<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
    </main>
  );

  const retryAnswer = bundle.turns.find((turn) => turn.attempt === 1 && turn.role === "user");

  return (
    <main id="main" className={`${page} space-y-16`}>
      <header>
        <h1 className="display text-2xl lg:text-3xl">{retry ? "See what changed." : "Make your next answer stronger."}</h1>
        <p className="mt-4 text-lg text-neutral-600">{scenario?.title ?? "Your rehearsal"} · {new Date(bundle.session.created_at).toLocaleDateString()}</p>
        <p className="mt-2 max-w-measure text-sm text-neutral-500">Coaching estimate, not an objective measure or a prediction of your real conversation. Every score reflects the words used in this practice.</p>
      </header>

      {retry && focus ? <section aria-labelledby="comparison-heading">
        <h2 id="comparison-heading" className={sectionTitle}>One objection. Two answers.</h2>
        <blockquote className="mb-10 mt-4 max-w-measure text-lg text-neutral-600">“{focus.objection}”</blockquote>
        <ComparisonBoard
          id="comparison"
          answers={{ before: focus.answer, after: retryAnswer?.text ?? "Your saved retry answer is unavailable." }}
          rows={rubric.map((dimension) => ({ label: dimension.label, before: focus.baselineScores[dimension.id].score, after: retry.scores[dimension.id].score }))}
          average={{ before: average(focus.baselineScores), after: average(retry.scores) }}
          caption="Same objection and rubric. These scores compare only these two answers."
        />
        <details className="group mt-4">
          <summary className={disclosure}>Read the reasoning behind the comparison{chevron}</summary>
          <div className="mt-2 divide-y divide-neutral-200">{rubric.map((dimension) => <div key={dimension.id} className="py-4">
            <h3 className="text-sm font-semibold">{dimension.label}</h3>
            <div className="mt-2 grid gap-x-10 gap-y-4 text-sm md:grid-cols-2">{[{ label: "Attempt 1", value: focus.baselineScores[dimension.id] }, { label: "Attempt 2", value: retry.scores[dimension.id] }].map(({ label, value }) => <div key={label}><p className="text-xs font-semibold text-neutral-500">{label}</p>{value.quote && <blockquote className="mt-1 break-words">“{value.quote}”</blockquote>}<p className="mt-1 text-neutral-500">{value.reason}</p></div>)}</div>
          </div>)}</div>
        </details>
      </section> : <OriginalRehearsal scores={first.scores} />}

      <section aria-labelledby="improvements-heading">
        <h2 id="improvements-heading" className={sectionTitle}>{retry ? "Keep working on these moments" : "Three changes to try"}</h2>
        <ol className="mt-6 space-y-4">
          {(retry ?? first).improvements.map((improvement, index) => (
            <Card as="li" key={index} className="flex gap-4 p-5 sm:gap-6 sm:p-8">
              <span aria-hidden="true" className="figure text-xl text-neutral-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="grid gap-x-10 gap-y-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <div><h3 className="text-sm font-semibold text-neutral-500">You said</h3><blockquote className="mt-2 whitespace-pre-wrap break-words text-neutral-500">“{improvement.quote}”</blockquote></div>
                  <div><h3 className="text-sm font-semibold">Say this instead</h3><blockquote className="mt-2 whitespace-pre-wrap break-words text-lg font-medium"><span className="mark">“{improvement.rewrite}”</span></blockquote></div>
                </div>
                <p className="mt-6 border-t border-neutral-200 pt-4 text-sm text-neutral-600"><strong className="font-semibold text-ink">Why: </strong>{improvement.why}</p>
              </div>
            </Card>
          ))}
        </ol>
        <p className="mt-4 text-sm text-neutral-500">Replace any bracketed prompts with facts you can support. Make the phrasing sound like you.</p>
      </section>

      {!retry && focus && <section className="rounded-lg bg-ink p-6 text-paper shadow-md sm:p-10" aria-labelledby="retry-heading">
        <div className="grid gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 id="retry-heading" className={sectionTitle}>Now put the coaching to work.</h2>
            <p className="mt-4 max-w-measure text-neutral-200">Answer this objection again. We’ll compare your new answer with the one you gave to this exact question.</p>
          </div>
          <blockquote className="text-lg font-medium lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-neutral-500 lg:pl-10 lg:text-xl lg:leading-snug">“{focus.objection}”</blockquote>
          <div className="lg:col-start-1">
            <ButtonLink variant="accent" href={`/practice/${bundle.session.scenario_id}?session=${sessionId}&retry=1`}><RotateCcw aria-hidden="true" className="size-4" />{retryAnswer ? "Finish my comparison" : "Retry this moment"}</ButtonLink>
            <p className="mt-4 text-sm text-neutral-300">Included in this session. Your daily limit doesn’t block the retry.</p>
          </div>
        </div>
      </section>}

      {retry && focus && <OriginalRehearsal scores={first.scores} />}

      <Delivery stats={(retry ?? first).delivery_stats} isRetry={Boolean(retry)} />

      {weakest && <section className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-t border-neutral-200 pt-10" aria-labelledby="next-heading">
        <div className="min-w-0">
          <h2 id="next-heading" className={sectionTitle}>Tomorrow, work on {weakest.label.toLowerCase()}.</h2>
          <p className="mt-4 max-w-measure text-neutral-600">This was the lowest-rated dimension in your {retry ? "retry" : "rehearsal"}. {weakest.exercise}</p>
          <p className="mt-3 max-w-measure text-sm text-neutral-500">Your next free session is available after midnight UTC. Today’s rehearsal and retry stay saved here.</p>
        </div>
        <ButtonLink variant="secondary" href={`/practice/${bundle.session.scenario_id}`}>Return to practice</ButtonLink>
      </section>}

      <details className="group border-t border-neutral-200 pt-4">
        <summary className="inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold">Read the full transcript{chevron}</summary>
        <ol className="mt-4 max-w-measure space-y-5">{bundle.turns.map((turn) => <li key={turn.id}><p className="text-sm font-semibold">{turn.role === "user" ? "You" : scenario?.counterpart.label ?? "Counterpart"}{turn.attempt === 1 ? " · Retry" : ""}</p><p className="mt-1 whitespace-pre-wrap break-words text-neutral-600">{turn.text}</p></li>)}</ol>
      </details>
    </main>
  );
}
