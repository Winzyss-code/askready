import { NextResponse } from "next/server";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import type { CoachingStep } from "@/lib/coaching-steps";
import { generateFeedback, generateRetryFeedback } from "@/lib/llm";
import { rateLimit } from "@/lib/rate-limit";
import { deliveryStats } from "@/lib/scoring";
import { acquireSessionLock, loadSession, requireUser, rpc } from "@/lib/sessions";
import { ndjson, wantsStream } from "@/lib/stream";
import { recordTiming } from "@/lib/timing";
import { feedbackInputSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const started = performance.now();
  let streamed = false;
  try {
    requireSameOrigin(request);
    const input = await readJson(request, feedbackInputSchema);
    const { user, accessToken } = await requireUser();
    await rateLimit(`feedback:${user.id}`, 6, 300_000);
    const release = acquireSessionLock(input.sessionId);
    try {
      const bundle = await loadSession(input.sessionId, accessToken);
      if (bundle.feedback.some((f) => f.attempt === input.attempt)) return NextResponse.json(bundle, { headers: { "Cache-Control": "no-store" } });
      const turns = bundle.turns.filter((t) => t.attempt === input.attempt);
      const focus = bundle.feedback.find((f) => f.attempt === 0)?.focus;
      const retry = turns.find((t) => t.role === "user");
      if (input.attempt === 1 && (!focus || !retry)) throw new ApiError(400, "RETRY_REQUIRED", "Answer the same objection again before comparing.");
      const coach = async (onStep?: (step: CoachingStep) => void) => {
        const generated = input.attempt === 0
          ? await generateFeedback(bundle.session, turns, onStep)
          : await generateRetryFeedback(bundle.session, focus!, retry!, onStep);
        onStep?.("saving");
        await rpc("save_feedback", { p_user_id: user.id, p_session_id: input.sessionId, p_attempt: input.attempt, p_scores: generated.scores, p_improvements: generated.improvements, p_delivery_stats: deliveryStats(turns), p_focus: "focus" in generated ? generated.focus : null, p_expected_count: turns.length });
        return loadSession(input.sessionId, accessToken);
      };
      if (!wantsStream(request)) return NextResponse.json(await coach(), { headers: { "Cache-Control": "no-store" } });
      // Progress is reported as the work reaches each step, so the waiting screen never runs ahead of the coach.
      streamed = true;
      return ndjson(async (send) => {
        send({ type: "step", step: "reading" });
        send({ type: "done", bundle: await coach((step) => send({ type: "step", step })) });
      }, () => { release(); recordTiming("feedback_total", performance.now() - started); });
    } finally {
      if (!streamed) release();
    }
  } catch (error) { return errorResponse(error); }
  finally { if (!streamed) recordTiming("feedback_total", performance.now() - started); }
}
