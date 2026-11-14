import { NextResponse } from "next/server";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { generateFeedback, generateRetryFeedback } from "@/lib/llm";
import { rateLimit } from "@/lib/rate-limit";
import { deliveryStats } from "@/lib/scoring";
import { loadSession, requireUser, rpc, withSessionLock } from "@/lib/sessions";
import { feedbackInputSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = await readJson(request, feedbackInputSchema);
    const { user, accessToken } = await requireUser();
    rateLimit(`feedback:${user.id}`, 6, 300_000);
    const result = await withSessionLock(input.sessionId, async () => {
      const bundle = await loadSession(input.sessionId, accessToken);
      if (bundle.feedback.some((f) => f.attempt === input.attempt)) return bundle;
      const turns = bundle.turns.filter((t) => t.attempt === input.attempt);
      const focus = bundle.feedback.find((f) => f.attempt === 0)?.focus;
      const retry = turns.find((t) => t.role === "user");
      if (input.attempt === 1 && (!focus || !retry)) throw new ApiError(400, "RETRY_REQUIRED", "Answer the same objection again before comparing.");
      const generated = input.attempt === 0
        ? await generateFeedback(bundle.session, turns)
        : await generateRetryFeedback(bundle.session, focus!, retry!);
      await rpc("save_feedback", { p_user_id: user.id, p_session_id: input.sessionId, p_attempt: input.attempt, p_scores: generated.scores, p_improvements: generated.improvements, p_delivery_stats: deliveryStats(turns), p_focus: "focus" in generated ? generated.focus : null, p_expected_count: turns.length });
      return loadSession(input.sessionId, accessToken);
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
