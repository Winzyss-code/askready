import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { requestSignInLink } from "@/lib/supabase";
export const runtime = "nodejs";

/** Emails a sign-in link to saved progress. The answer is the same whether or not the address has an account. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const input = await readJson(request, z.object({ email: z.email().max(254).transform((email) => email.trim().toLowerCase()), captchaToken: z.string().min(1).max(4096).optional() }).strict());
    await rateLimit(`email-ip:${requestIp(request)}`, 10, 3_600_000);
    await rateLimit(`sign-in:${input.email}`, 3, 3_600_000);
    await requestSignInLink(input.email, `${request.headers.get("origin")}/auth/callback`, input.captchaToken);
    return NextResponse.json({ sent: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
