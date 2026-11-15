import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { checkUserStorage, ensureAnonymousUser } from "@/lib/supabase";
import { recordTiming } from "@/lib/timing";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    requireSameOrigin(request);
    await rateLimit(`auth:${requestIp(request)}`);
    const input = await readJson(request, z.object({ captchaToken: z.string().min(1).max(4096).optional() }).strict());
    const { user, accessToken } = await ensureAnonymousUser(input.captchaToken);
    await checkUserStorage(accessToken);
    return NextResponse.json({ user: { id: user.id }, storage: "ready" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    recordTiming("auth", performance.now() - startedAt);
  }
}
