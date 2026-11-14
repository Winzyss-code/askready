import { NextResponse } from "next/server";
import { getScenario } from "@/config/scenarios";
import { getPersona } from "@/config/personas";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { assertLlmConfigured, roleplay } from "@/lib/llm";
import { rateLimit } from "@/lib/rate-limit";
import { loadSession, requireUser, rpc, userQuery, withSessionLock } from "@/lib/sessions";
import { turnInputSchema } from "@/lib/validation";
import type { Session, Turn } from "@/types/domain";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const started = performance.now();
  try {
    requireSameOrigin(request);
    const input = await readJson(request, turnInputSchema);
    const { user, accessToken } = await requireUser();
    rateLimit(`turn:${user.id}`, 20);
    const result = await withSessionLock(input.action === "start" ? user.id : input.sessionId, async () => {
      if (input.action === "start") {
        if (!getScenario(input.scenarioId)?.live || !getPersona(input.personaId)) throw new ApiError(400, "INVALID_SCENARIO", "Choose an available scenario and manager.");
        const existing = await userQuery<Session[]>(`sessions?request_id=eq.${input.requestId}&select=*`, accessToken);
        if (existing[0]) return loadSession(existing[0].id, accessToken);
        const today = new Date().toISOString().slice(0, 10);
        const used = await userQuery<Session[]>(`sessions?created_at=gte.${today}T00:00:00Z&limit=1&select=id`, accessToken);
        if (used.length) throw new ApiError(429, "DAILY_LIMIT", "You’ve used today’s free session. Resume your saved practice or come back tomorrow (UTC).");
        assertLlmConfigured();
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ApiError(503, "STORAGE_NOT_CONFIGURED", "The app owner needs to configure server storage before practice can begin.");
        const opening = await roleplay({ setup: input.setup, scenario_id: input.scenarioId, persona_id: input.personaId }, []);
        const session = await rpc<Session>("create_practice", { p_user_id: user.id, p_scenario_id: input.scenarioId, p_persona_id: input.personaId, p_setup: input.setup, p_request_id: input.requestId, p_opening: opening });
        return loadSession(session.id, accessToken);
      }
      const bundle = await loadSession(input.sessionId, accessToken);
      if (bundle.turns.some((turn) => turn.request_id === input.requestId)) return bundle;
      const original = bundle.turns.filter((turn) => turn.attempt === 0);
      if (input.attempt === 0 && bundle.session.status !== "practice") throw new ApiError(409, "SESSION_CLOSED", "This conversation is finished. Open the feedback to continue.");
      if (input.attempt === 0 && original.filter((t) => t.role === "user").length >= 6) throw new ApiError(409, "TURN_LIMIT", "You’ve reached six answers. Get feedback to continue.");
      if (input.attempt === 1 && (!bundle.feedback.find((f) => f.attempt === 0)?.focus || bundle.session.status !== "feedback")) throw new ApiError(409, "SESSION_CLOSED", "Get your first feedback before retrying an objection.");
      if (input.attempt === 1 && bundle.turns.some((t) => t.attempt === 1 && t.role === "user")) throw new ApiError(409, "RETRY_EXISTS", "Your retry is already saved. Open the comparison to continue.");
      const sequence = input.attempt === 0 ? Math.max(-1, ...original.map((t) => t.sequence)) + 1 : 0;
      const next: Turn = { id: input.requestId, request_id: input.requestId, session_id: input.sessionId, role: "user", text: input.text, audio_duration_ms: input.audioDurationMs ?? null, attempt: input.attempt, sequence, created_at: new Date().toISOString() };
      const reply = input.attempt === 0 ? await roleplay(bundle.session, [...original, next]) : null;
      await rpc("append_exchange", { p_user_id: user.id, p_session_id: input.sessionId, p_request_id: input.requestId, p_text: input.text, p_audio_duration_ms: input.audioDurationMs ?? null, p_attempt: input.attempt, p_expected_sequence: sequence, p_reply: reply });
      return loadSession(input.sessionId, accessToken);
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
  finally { console.info(JSON.stringify({ event: "stage_timing", stage: "turn_total", durationMs: Math.round(performance.now() - started) })); }
}
