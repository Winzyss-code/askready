import { rubric } from "@/config/rubric";
import { liveScenarios } from "@/config/scenarios";
import type { Dimension, Scores, Session } from "@/types/domain";

// Progress is derived from saved sessions on every request; nothing here is stored.
// Days are UTC days because the free daily session resets at midnight UTC (create_practice in supabase/schema.sql).

/** A saved session with the scores from its first, uncoached conversation (feedback attempt 0), if it has any yet. */
export type ProgressSession = Pick<Session, "id" | "scenario_id" | "status" | "created_at"> & { scores: Scores | null };
export type Progress = {
  completed: number;
  today: { used: boolean; sessionId: string | null; scenarioId: string | null; status: Session["status"] | null };
  streak: { current: number; week: { date: string; done: boolean }[] };
  skills: { id: Dimension; label: string; score: number | null; level: number | null; samples: number }[];
  scenarios: { id: string; completed: number; lastAt: string | null }[];
  next: { scenarioId: string; focus: Dimension | null };
};

const DAY_MS = 86_400_000;
const SKILL_WINDOW = 3;
const utcDay = (value: string | number | Date) => new Date(value).toISOString().slice(0, 10);

export function levelFor(score: number) {
  return score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
}

export function buildProgress(sessions: ProgressSession[], now: Date = new Date()): Progress {
  const newestFirst = [...sessions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  // A session counts as completed once it has coaching. One still in practice only uses up the day.
  const completed = newestFirst.filter((session) => session.status !== "practice");
  const today = utcDay(now);
  const todays = newestFirst.find((session) => utcDay(session.created_at) === today);

  const practicedDays = new Set(completed.map((session) => utcDay(session.created_at)));
  const dayBefore = (offset: number) => utcDay(now.getTime() - offset * DAY_MS);
  // Start from yesterday when today is still open, so the count doesn't look broken before today's session.
  let offset = practicedDays.has(today) ? 0 : 1;
  let current = 0;
  while (practicedDays.has(dayBefore(offset))) { current++; offset++; }
  const week = Array.from({ length: 7 }, (_, index) => dayBefore(6 - index)).map((date) => ({ date, done: practicedDays.has(date) }));

  const recent = completed.flatMap((session) => session.scores ? [session.scores] : []).slice(0, SKILL_WINDOW);
  const skills = rubric.map(({ id, label }) => {
    const score = recent.length ? Math.round(recent.reduce((sum, scores) => sum + scores[id].score, 0) / recent.length) : null;
    return { id, label, score, level: score === null ? null : levelFor(score), samples: recent.length };
  });
  const focus = skills.reduce<{ id: Dimension; score: number } | null>((lowest, skill) => skill.score !== null && (!lowest || skill.score < lowest.score) ? { id: skill.id, score: skill.score } : lowest, null);

  const scenarios = liveScenarios.map((scenario) => {
    const own = completed.filter((session) => session.scenario_id === scenario.id);
    return { id: scenario.id, completed: own.length, lastAt: own[0]?.created_at ?? null };
  });
  // Never practiced first, in config order; then whichever was practiced longest ago.
  const next = [...scenarios].sort((a, b) => (a.lastAt ? Date.parse(a.lastAt) : 0) - (b.lastAt ? Date.parse(b.lastAt) : 0))[0];

  return {
    completed: completed.length,
    today: { used: Boolean(todays), sessionId: todays?.id ?? null, scenarioId: todays?.scenario_id ?? null, status: todays?.status ?? null },
    streak: { current, week },
    skills,
    scenarios,
    next: { scenarioId: next?.id ?? "", focus: focus?.id ?? null },
  };
}
