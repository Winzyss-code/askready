import { z } from "zod";
import { errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/sessions";
import { recordTiming } from "@/lib/timing";
export const runtime = "nodejs";

// Timings only a browser can measure, such as from sending an answer to hearing the first word of the reply.
const timingSchema = z.object({ stage: z.enum(["client_reply_first_audio", "client_coaching_total"]), durationMs: z.number().int().min(0).max(180_000) }).strict();

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = await readJson(request, timingSchema);
    const { user } = await requireUser();
    await rateLimit(`timing:${user.id}`, 30);
    recordTiming(input.stage, input.durationMs);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
