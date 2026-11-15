import { NextResponse } from "next/server";
import { getScenario } from "@/config/scenarios";
import { personasFor } from "@/config/personas";
import { FREE_SESSIONS_PER_DAY } from "@/config/plans";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { assertLlmConfigured, roleplay, type ReplyEvent } from "@/lib/llm";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { acquireSessionLock, loadSession, requireUser, rpc, saveEmotion, userQuery } from "@/lib/sessions";
import { ndjson, wantsStream, type Send } from "@/lib/stream";
import { recordTiming } from "@/lib/timing";
import { synthesize } from "@/lib/tts";
import { turnInputSchema } from "@/lib/validation";
import type { Emotion } from "@/lib/emotion";
import type { Session, SessionBundle, Turn } from "@/types/domain";
export const runtime = "nodejs";
export const maxDuration = 60;

// New sessions from one network per UTC day, across every anonymous account on it. Generous on purpose: a
// venue or office shares one address. It stops clearing cookies over and over, not a determined abuser.
const NEW_SESSIONS_PER_IP = Number(process.env.NEW_SESSIONS_PER_IP_PER_DAY) || 30;

// The reply's mood also travels with this response, attached to the newest counterpart turn.
function withReaction(bundle: SessionBundle, emotion: Emotion): SessionBundle {
  const latest = bundle.turns.filter((turn) => turn.role === "assistant" && turn.attempt === 0).sort((a, b) => b.sequence - a.sequence)[0];
  return latest ? { ...bundle, reaction: { turnId: latest.id, emotion } } : bundle;
}

/**
 * Speaks each kept sentence as soon as the model finishes it, while it is still writing the next one.
 * Audio goes out in sentence order. A sentence whose speech fails is sent as text, for the browser's voice.
 */
function sentenceVoice(send: Send, started: number) {
  let chain = Promise.resolve();
  let first = true;
  return {
    say(text: string, index: number) {
      const audio = synthesize(text).then((data) => data, () => null);
      chain = chain.then(async () => {
        const data = await audio;
        if (data && first) { first = false; recordTiming("reply_first_audio", performance.now() - started); }
        send(data ? { type: "audio", index, data: Buffer.from(data).toString("base64") } : { type: "audio", index, text, error: true });
      });
    },
    finished: () => chain,
  };
}

/**
 * Streams the counterpart's words and voice, then saves; `save` returns the saved session. `saved` runs as soon as
 * the exchange is stored (to release the session lock), while the last sentences' voices may still be on the way.
 */
function streamReply(started: number, generate: (onEvent: (event: ReplyEvent) => void) => Promise<{ text: string; emotion: Emotion }>, save: (text: string) => Promise<SessionBundle>, saved: () => void) {
  return async (send: Send) => {
    const voice = sentenceVoice(send, started);
    let firstSentence = true;
    const reply = await generate((event) => {
      if (event.type === "sentence") {
        if (firstSentence) { firstSentence = false; recordTiming("reply_first_sentence", performance.now() - started); }
        voice.say(event.text, event.index);
      }
      send(event);
    });
    const bundle = withReaction(await save(reply.text), reply.emotion);
    saved();
    send({ type: "done", bundle });
    await Promise.all([voice.finished(), saveEmotion(bundle.reaction)]);
  };
}

export async function POST(request: Request) {
  const started = performance.now();
  let streamed = false;
  try {
    requireSameOrigin(request);
    const input = await readJson(request, turnInputSchema);
    const { user, accessToken } = await requireUser();
    await rateLimit(`turn:${user.id}`, 20);
    const release = acquireSessionLock(input.action === "start" ? user.id : input.sessionId);
    try {
      const reply = (bundle: SessionBundle | Promise<SessionBundle>) => Promise.resolve(bundle).then((value) => NextResponse.json(value, { headers: { "Cache-Control": "no-store" } }));
      const finish = () => { release(); recordTiming("turn_total", performance.now() - started); };
      if (input.action === "start") {
        const scenario = getScenario(input.scenarioId);
        if (!scenario?.live || !personasFor(scenario).some((persona) => persona.id === input.personaId)) throw new ApiError(400, "INVALID_SCENARIO", "Choose an available scenario and counterpart.");
        const existing = await userQuery<Session[]>(`sessions?request_id=eq.${input.requestId}&select=*`, accessToken);
        if (existing[0]) return await reply(loadSession(existing[0].id, accessToken));
        const today = new Date().toISOString().slice(0, 10);
        const used = await userQuery<Session[]>(`sessions?created_at=gte.${today}T00:00:00Z&limit=${FREE_SESSIONS_PER_DAY}&select=id`, accessToken);
        if (used.length >= FREE_SESSIONS_PER_DAY) throw new ApiError(429, "DAILY_LIMIT", "You’ve used today’s free session. Resume your saved practice or come back tomorrow (UTC).");
        assertLlmConfigured();
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ApiError(503, "STORAGE_NOT_CONFIGURED", "The app owner needs to configure server storage before practice can begin.");
        const ip = requestIp(request);
        if (ip !== "local" && ip !== "unknown") {
          try { await rateLimit(`start-ip:${ip}`, NEW_SESSIONS_PER_IP, 86_400_000); }
          catch (error) {
            if (error instanceof ApiError && error.code === "RATE_LIMITED") throw new ApiError(429, "NETWORK_LIMIT", "Too many new sessions have started from this network today. Resume a saved session, or come back tomorrow (UTC).");
            throw error;
          }
        }
        const context = { setup: input.setup, scenario_id: input.scenarioId, persona_id: input.personaId };
        const create = async (opening: string) => {
          const session = await rpc<Session>("create_practice", { p_user_id: user.id, p_scenario_id: input.scenarioId, p_persona_id: input.personaId, p_setup: input.setup, p_request_id: input.requestId, p_opening: opening });
          return loadSession(session.id, accessToken);
        };
        if (wantsStream(request)) {
          streamed = true;
          return ndjson(streamReply(started, (onEvent) => roleplay(context, [], onEvent), create, release), finish);
        }
        const opening = await roleplay(context, []);
        const saved = withReaction(await create(opening.text), opening.emotion);
        await saveEmotion(saved.reaction);
        return await reply(saved);
      }
      const bundle = await loadSession(input.sessionId, accessToken);
      if (bundle.turns.some((turn) => turn.request_id === input.requestId)) return await reply(bundle);
      const original = bundle.turns.filter((turn) => turn.attempt === 0);
      if (input.attempt === 0 && bundle.session.status !== "practice") throw new ApiError(409, "SESSION_CLOSED", "This conversation is finished. Open the feedback to continue.");
      if (input.attempt === 0 && original.filter((t) => t.role === "user").length >= 6) throw new ApiError(409, "TURN_LIMIT", "You’ve reached six answers. Get feedback to continue.");
      if (input.attempt === 1 && (!bundle.feedback.find((f) => f.attempt === 0)?.focus || bundle.session.status !== "feedback")) throw new ApiError(409, "SESSION_CLOSED", "Get your first feedback before retrying an objection.");
      if (input.attempt === 1 && bundle.turns.some((t) => t.attempt === 1 && t.role === "user")) throw new ApiError(409, "RETRY_EXISTS", "Your retry is already saved. Open the comparison to continue.");
      const sequence = input.attempt === 0 ? Math.max(-1, ...original.map((t) => t.sequence)) + 1 : 0;
      const next: Turn = { id: input.requestId, request_id: input.requestId, session_id: input.sessionId, role: "user", text: input.text, audio_duration_ms: input.audioDurationMs ?? null, attempt: input.attempt, sequence, created_at: new Date().toISOString() };
      const save = async (replyText: string | null) => {
        await rpc("append_exchange", { p_user_id: user.id, p_session_id: input.sessionId, p_request_id: input.requestId, p_text: input.text, p_audio_duration_ms: input.audioDurationMs ?? null, p_attempt: input.attempt, p_expected_sequence: sequence, p_reply: replyText });
        return loadSession(input.sessionId, accessToken);
      };
      // A retry gets no reply: the coach compares it next.
      if (input.attempt === 1) return await reply(save(null));
      if (wantsStream(request)) {
        streamed = true;
        return ndjson(streamReply(started, (onEvent) => roleplay(bundle.session, [...original, next], onEvent), save, release), finish);
      }
      const generated = await roleplay(bundle.session, [...original, next]);
      const saved = withReaction(await save(generated.text), generated.emotion);
      await saveEmotion(saved.reaction);
      return await reply(saved);
    } finally {
      if (!streamed) release();
    }
  } catch (error) { return errorResponse(error); }
  finally { if (!streamed) recordTiming("turn_total", performance.now() - started); }
}
