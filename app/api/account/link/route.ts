import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/sessions";
import { accountOf, requestSaveLink } from "@/lib/supabase";
export const runtime = "nodejs";

/** Emails a link that saves this browser's anonymous account under an address. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = await readJson(request, z.object({ email: z.email().max(254).transform((email) => email.trim().toLowerCase()) }).strict());
    const { user, accessToken } = await requireUser();
    if (!accountOf(user).anonymous) throw new ApiError(409, "ALREADY_SAVED", "Your progress is already saved to an email.");
    await rateLimit(`link:${user.id}`, 3, 3_600_000);
    await rateLimit(`email-ip:${requestIp(request)}`, 10, 3_600_000);
    await requestSaveLink(accessToken, input.email, `${request.headers.get("origin")}/auth/callback`);
    return NextResponse.json({ sent: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
