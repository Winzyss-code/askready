import { z } from "zod";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser, userQuery } from "@/lib/sessions";
import { synthesize } from "@/lib/tts";
import type { Turn } from "@/types/domain";
import { recordTiming } from "@/lib/timing";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const started = performance.now();
  try {
    requireSameOrigin(request);
    const input = await readJson(request, z.object({ sessionId: z.uuid(), turnId: z.uuid() }).strict());
    const { user, accessToken } = await requireUser();
    await rateLimit(`tts:${user.id}`, 24);
    // RLS checks session ownership; fetch only the reply needed for playback.
    const turns = await userQuery<Pick<Turn, "id" | "text">[]>(`turns?id=eq.${input.turnId}&session_id=eq.${input.sessionId}&role=eq.assistant&select=id,text`, accessToken);
    const turn = turns[0];
    if (!turn) throw new ApiError(404, "TURN_NOT_FOUND", "That reply is not available.");
    return new Response(await synthesize(turn.text), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
  finally { recordTiming("speak_total", performance.now() - started); }
}
