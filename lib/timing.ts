import "server-only";

// Every stage timing is a log line. Inside the running app it is also saved as a row (stage and duration only,
// nothing about the user) for the /speed page, once supabase/migrations/003_resilience.sql is applied.
// Scripts and tests never save rows: NEXT_RUNTIME is only set by Next.
let pausedUntil = 0;

export function recordTiming(stage: string, durationMs: number) {
  const ms = Math.max(0, Math.round(durationMs));
  console.info(JSON.stringify({ event: "stage_timing", stage, durationMs: ms }));
  if (!process.env.NEXT_RUNTIME || Date.now() < pausedUntil) return;
  const save = (async () => {
    const { adminRequest } = await import("@/lib/supabase");
    const response = await adminRequest("stage_timings", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ stage, duration_ms: ms }) });
    // Most likely the table isn't there yet. Don't ask again on every request.
    if (!response.ok) pausedUntil = Date.now() + 5 * 60_000;
  })().catch(() => { pausedUntil = Date.now() + 60_000; });
  // Let the row finish saving after the response is sent, where the platform allows it.
  void import("next/server").then(({ after }) => after(save)).catch(() => undefined);
}
