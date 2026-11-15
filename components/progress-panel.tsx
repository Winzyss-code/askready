"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { freeAllowance } from "@/config/plans";
import { rubric } from "@/config/rubric";
import { getScenario, liveScenarios, type Scenario } from "@/config/scenarios";
import { api, ensureClientAuth, errorMessage } from "@/lib/client";
import { cx } from "@/lib/cx";
import type { Progress } from "@/lib/progress";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { Bar } from "@/components/ui/score-bar";
import { AddToCalendar } from "@/components/add-to-calendar";

const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? "" : "s"}`;
const inARow = (days: number) => `${count(days, "day")} in a row`;
const shortDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The signed-in browser's progress, worked out by the server from saved sessions. */
export function useProgress(enabled = true) {
  const [state, setState] = useState<{ progress: Progress | null; error: string | null; loading: boolean }>({ progress: null, error: null, loading: enabled });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    (async () => {
      try {
        await ensureClientAuth();
        const { progress } = await api<{ progress: Progress }>("/api/progress", undefined, { signal: controller.signal });
        setState({ progress, error: null, loading: false });
      } catch (error) {
        if (!controller.signal.aborted) setState({ progress: null, error: errorMessage(error), loading: false });
      }
    })();
    return () => controller.abort();
  }, [attempt, enabled]);
  return { ...state, retry: () => { setState({ progress: null, error: null, loading: true }); setAttempt((value) => value + 1); } };
}

/** One line for the landing hero. Renders nothing for a new visitor, while loading, or on any error. */
export function ProgressStrip({ className }: { className?: string }) {
  const { progress } = useProgress();
  const next = progress && getScenario(progress.next.scenarioId);
  if (!progress || progress.completed === 0 || !next) return null;
  return (
    <p className={cx("flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-neutral-300 pt-4 text-sm animate-settle", className)}>
      <span className="font-semibold">{progress.streak.current > 0 ? inARow(progress.streak.current) : `${count(progress.completed, "session")} completed`}</span>
      <Link className="link flex min-h-11 items-center gap-2" href={`/practice/${next.id}`}>{progress.today.used ? "Tomorrow" : "Next"}: {next.title}<ArrowRight aria-hidden="true" className="size-4" /></Link>
      <Link className="link flex min-h-11 items-center text-neutral-600" href="/progress">Your progress</Link>
    </p>
  );
}

/** For the results page: days in a row and tomorrow's suggested conversation. Nothing until real numbers load. */
export function ProgressNext({ className }: { className?: string }) {
  const { progress } = useProgress();
  const next = progress && getScenario(progress.next.scenarioId);
  if (!progress || !next) return null;
  return (
    <p className={cx("max-w-measure animate-settle", className)}>
      {progress.streak.current > 0 && <><span className="font-semibold">{inARow(progress.streak.current)}.</span>{" "}</>}
      Tomorrow’s suggested conversation: <Link className="link" href={`/practice/${next.id}`}>{next.title}</Link>.
      <AddToCalendar className="mt-1 flex text-sm" scenarioId={next.id} focus={progress.next.focus} />
    </p>
  );
}

function Week({ week }: { week: Progress["streak"]["week"] }) {
  return (
    <ol className="mt-6 flex gap-3" aria-label="Last seven days">
      {week.map(({ date, done }, index) => {
        const day = new Date(`${date}T00:00:00Z`);
        return (
          <li key={date} className="flex flex-col items-center gap-2">
            <span aria-hidden="true" className="text-xs font-semibold text-neutral-500">{day.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}</span>
            <span aria-hidden="true" className={cx("block size-6 rounded-full", done ? "bg-ink" : "border border-neutral-300", index === week.length - 1 && "outline outline-2 outline-offset-2 outline-marker")} />
            <span className="sr-only">{day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}: {done ? "practiced" : "no session"}{index === week.length - 1 ? " (today)" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function NextSession({ progress }: { progress: Progress }) {
  const next = getScenario(progress.next.scenarioId);
  const focus = rubric.find((item) => item.id === progress.next.focus);
  const { today } = progress;
  const open = today.status === "practice";
  return (
    <Card as="section" className="p-6 sm:p-8" aria-labelledby="next-session-heading">
      <p className="text-sm font-semibold text-neutral-500">{open ? "Today" : today.used ? "Tomorrow" : "Next up"}</p>
      <h2 id="next-session-heading" className="display mt-1 text-xl">{open ? getScenario(today.scenarioId ?? "")?.title ?? "Today’s session" : next?.title}</h2>
      {open
        ? <p className="mt-3 text-neutral-600">Today’s rehearsal is still open. Finish it to get your coaching.</p>
        : focus && <p className="mt-3 text-neutral-600"><span className="font-semibold text-ink">Work on {focus.label.toLowerCase()}.</span> {focus.exercise}</p>}
      {today.used && !open && <p className="mt-3 text-sm text-neutral-500">Today’s session is done. Your next free session is available after midnight UTC.</p>}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {open && today.sessionId && today.scenarioId && <ButtonLink href={`/practice/${today.scenarioId}?session=${today.sessionId}`}>Resume rehearsal<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>}
        {!today.used && next && <ButtonLink href={`/practice/${next.id}`}>Start today’s session<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>}
        {today.used && !open && today.sessionId && <ButtonLink variant="secondary" href={`/results/${today.sessionId}`}>Review today’s coaching</ButtonLink>}
        {today.used && !open && next && <Link className="link flex min-h-11 items-center" href={`/practice/${next.id}`}>Read tomorrow’s technique</Link>}
        {!open && next && <AddToCalendar scenarioId={next.id} focus={progress.next.focus} />}
      </div>
    </Card>
  );
}

/** Shown in place of the setup form once today's free session is used. The server still enforces the limit. */
export function DailyLimit({ progress, scenario, className }: { progress: Progress; scenario: Scenario; className?: string }) {
  const { today } = progress;
  const todays = getScenario(today.scenarioId ?? "");
  const next = getScenario(progress.next.scenarioId);
  const open = today.status === "practice";
  const now = new Date();
  const unlocks = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <Card as="section" className={cx("p-6 sm:p-8 animate-settle", className)} aria-labelledby="limit-heading">
      <h2 id="limit-heading" className="display text-xl">That’s today’s session.</h2>
      <p className="mt-3 max-w-measure text-neutral-600">
        {open
          ? <>Your rehearsal{todays && <> of “{todays.title}”</>} is still open. Finish it to get your coaching.</>
          : <>You practiced{todays ? <> “{todays.title}”</> : ""} today. Your coaching is saved.</>}
        {" "}The next free session opens at midnight UTC, which is <span className="tabular">{unlocks}</span> your time.
      </p>
      {today.sessionId && today.scenarioId && <div className="mt-6">
        {open
          ? <ButtonLink href={`/practice/${today.scenarioId}?session=${today.sessionId}`}>Resume rehearsal<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
          : <ButtonLink variant="secondary" href={`/results/${today.sessionId}`}>Review today’s coaching<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>}
      </div>}
      <dl className="mt-8">
        {next && <div className="border-t border-neutral-300 py-4">
          <dt className="text-sm font-semibold text-neutral-500">Suggested for tomorrow</dt>
          <dd className="mt-1">{next.id === scenario.id
            ? <>This conversation. The technique above is yours to read tonight.</>
            : <Link className="link inline-flex min-h-11 items-center gap-2" href={`/practice/${next.id}`}>{next.title}<ArrowRight aria-hidden="true" className="size-4" /></Link>}</dd>
        </div>}
        <div className="border-t border-neutral-300 pt-4">
          <dt className="text-sm font-semibold text-neutral-500">Need more than {freeAllowance}?</dt>
          <dd className="mt-1">Pro will remove the daily limit. It isn’t for sale yet. <Link className="link" href="/pricing">See what’s planned</Link></dd>
        </div>
      </dl>
    </Card>
  );
}

/** The whole /progress page body: loading, error, empty and loaded states. */
export function ProgressOverview() {
  const { progress, error, loading, retry } = useProgress();
  const sectionTitle = "display text-xl";

  if (loading) return (
    <div className="mt-12" aria-busy="true">
      <p role="status" className="text-sm text-neutral-500">Loading your progress…</p>
      <Skeleton className="mt-6 h-24 max-w-md" /><Skeleton className="mt-10 h-48" />
    </div>
  );
  if (error || !progress) return (
    <Notice tone="error" role="alert" className="mt-12 max-w-measure" title="We couldn’t load your progress.">
      <p>{error}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={retry}>Try again</Button>
    </Notice>
  );
  if (progress.completed === 0) {
    const { today } = progress;
    const first = liveScenarios[0];
    return (
      <div className="mt-12 max-w-measure border-t border-neutral-300 pt-8">
        <p className="text-lg">{today.status === "practice" ? "Today’s rehearsal is still open. Your skill levels appear once it has coaching." : "Nothing to show yet. Your skill levels appear after your first coached session."}</p>
        {today.status === "practice" && today.sessionId && today.scenarioId
          ? <ButtonLink className="mt-6" href={`/practice/${today.scenarioId}?session=${today.sessionId}`}>Resume rehearsal<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
          : first && <ButtonLink className="mt-6" href={`/practice/${first.id}`}>Start with “{first.title}”<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>}
      </div>
    );
  }

  const samples = progress.skills[0]?.samples ?? 0;
  return (
    <div className="mt-12 space-y-16 lg:space-y-24">
      <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="days-heading">
          <h2 id="days-heading" className="text-sm font-semibold text-neutral-500">Days in a row</h2>
          <p className="figure mt-2 text-3xl">{progress.streak.current}</p>
          <Week week={progress.streak.week} />
          <p className="mt-6 text-sm text-neutral-500">{count(progress.completed, "session")} completed. Days are counted in UTC, the same clock as the free daily session.</p>
        </section>
        <NextSession progress={progress} />
      </div>

      <section className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="skills-heading">
        <div>
          <h2 id="skills-heading" className={sectionTitle}>Skill levels</h2>
          <p className="mt-4 max-w-measure text-neutral-600">Levels are coaching estimates, averaged from {samples === 1 ? "your first attempt so far" : `your last ${samples === 2 ? "two" : "three"} first attempts`}, before any coaching. They are not a validated measurement.</p>
          <p className="mt-3 max-w-measure text-sm text-neutral-500">Level 1 is 0–39, level 2 is 40–59, level 3 is 60–79 and level 4 is 80–100.</p>
        </div>
        <ul>
          {progress.skills.map((skill) => skill.score !== null && (
            <li key={skill.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-neutral-300 py-4 last:border-b sm:grid-cols-[10rem_5.5rem_minmax(0,1fr)_2.5rem]">
              <span className="text-sm font-semibold">{skill.label}</span>
              <span className="tabular row-start-3 text-sm text-neutral-600 max-sm:col-span-2 sm:row-start-auto">Level {skill.level} of 4</span>
              <Bar value={skill.score} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
              <span className="figure col-start-2 row-start-1 text-right text-lg sm:col-start-auto sm:row-start-auto">{skill.score}<span className="sr-only"> out of 100</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="conversations-heading">
        <h2 id="conversations-heading" className={sectionTitle}>Conversations</h2>
        <ul>
          {progress.scenarios.map((item) => {
            const scenario = getScenario(item.id);
            return scenario && (
              <li key={item.id} className="flex items-center justify-between gap-x-6 border-t border-neutral-300 py-5 last:border-b">
                <div className="min-w-0">
                  <h3 className="font-semibold">{scenario.title}</h3>
                  <p className="tabular mt-1 text-sm text-neutral-600">{item.lastAt ? `${count(item.completed, "session")} · last on ${shortDate(item.lastAt)}` : "Not practiced yet"}</p>
                </div>
                <Link className="link flex min-h-11 shrink-0 items-center gap-2" href={`/practice/${scenario.id}`}>Practice<span className="sr-only">: {scenario.title}</span><ArrowRight aria-hidden="true" className="size-4" /></Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
