import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { checkUserStorage, ensureAnonymousUser } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    requireSameOrigin(request);
    rateLimit(`auth:${requestIp(request)}`);
    await readJson(request, z.object({}).strict());
    const { user, accessToken } = await ensureAnonymousUser();
    await checkUserStorage(accessToken);
    return NextResponse.json({ user: { id: user.id }, storage: "ready" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    console.info(JSON.stringify({ event: "stage_timing", stage: "auth", durationMs: Math.round(performance.now() - startedAt) }));
  }
}
