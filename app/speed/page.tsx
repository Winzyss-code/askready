import type { Metadata } from "next";
import { adminRequest } from "@/lib/supabase";

export const metadata: Metadata = { title: "Speed" };
export const dynamic = "force-dynamic";

type Row = { stage: string; samples: number; p50_ms: number; p90_ms: number; max_ms: number };

// In reading order. "Browser" stages are measured on the visitor's device; the rest on the server.
const groups: { title: string; stages: [string, string][] }[] = [
  { title: "Talking", stages: [
    ["client_reply_first_audio", "Answer sent → reply starts playing (browser)"],
    ["reply_first_sentence", "Answer received → first sentence of the reply written"],
    ["reply_first_audio", "Answer received → first sentence’s voice ready"],
    ["roleplay", "Writing the whole reply (model)"],
    ["turn_total", "Answer received → reply saved"],
    ["transcribe_total", "Transcribing a recording, whole request"],
    ["speak_total", "Replaying a saved reply’s voice, whole request"],
  ] },
  { title: "Coaching", stages: [
    ["client_coaching_total", "Asked for coaching → coaching ready (browser)"],
    ["feedback_total", "Coaching request, whole"],
    ["feedback", "Scoring a whole conversation (model)"],
    ["retry_feedback", "Scoring a retry (model)"],
  ] },
  { title: "Building blocks", stages: [
    ["transcribe", "Speech to text (provider)"],
    ["speak", "Text to speech, one sentence or reply (provider)"],
    ["auth", "Opening your account"],
  ] },
];

async function summary(): Promise<Row[] | null> {
  try {
    const response = await adminRequest("rpc/stage_timing_summary", { method: "POST", body: JSON.stringify({ p_days: 7 }) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

/** Measured response times, so speed can be quoted from real use rather than targets. */
export default async function SpeedPage() {
  const rows = await summary();
  const byStage = new Map((rows ?? []).map((row) => [row.stage, row]));
  return (
    <main id="main" className="shell pt-8 lg:pt-16">
      <h1 className="display text-2xl sm:text-3xl">How fast it is</h1>
      <p className="mt-6 max-w-measure text-lg text-neutral-600">Measured from real use over the last seven days: the median, and the time 9 in 10 requests beat. Each row is a stage and a duration only; nothing about who or what was said.</p>
      {rows === null ? <p className="mt-12 max-w-measure border-t border-neutral-300 pt-6 text-neutral-600">Timing isn’t being recorded yet. The app owner needs to apply <code>supabase/migrations/003_resilience.sql</code>.</p>
        : rows.length === 0 ? <p className="mt-12 max-w-measure border-t border-neutral-300 pt-6 text-neutral-600">No timings in the last seven days yet.</p>
        : groups.map((group) => {
          const present = group.stages.filter(([stage]) => byStage.has(stage));
          return present.length > 0 && (
            <section key={group.title} className="mt-12 max-w-3xl" aria-labelledby={`speed-${group.title}`}>
              <h2 id={`speed-${group.title}`} className="display text-xl">{group.title}</h2>
              <table className="mt-4 w-full text-left text-sm">
                <thead className="text-xs font-semibold text-neutral-500">
                  <tr><th scope="col" className="py-2 pr-4 font-semibold">Stage</th><th scope="col" className="py-2 pr-4 text-right font-semibold">Median</th><th scope="col" className="py-2 pr-4 text-right font-semibold">9 in 10</th><th scope="col" className="py-2 text-right font-semibold">Samples</th></tr>
                </thead>
                <tbody>{present.map(([stage, label]) => {
                  const row = byStage.get(stage)!;
                  return (
                    <tr key={stage} className="border-t border-neutral-300">
                      <th scope="row" className="py-3 pr-4 font-normal">{label}</th>
                      <td className="tabular py-3 pr-4 text-right font-semibold">{seconds(row.p50_ms)}</td>
                      <td className="tabular py-3 pr-4 text-right">{seconds(row.p90_ms)}</td>
                      <td className="tabular py-3 text-right text-neutral-500">{row.samples}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </section>
          );
        })}
      <p className="mt-12 max-w-measure text-sm text-neutral-500">Small samples move a lot. Browser times include the visitor’s own connection.</p>
    </main>
  );
}
