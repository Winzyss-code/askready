import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { adoptSession } from "@/lib/supabase";
export const runtime = "nodejs";

// From /auth/callback: the session an email link carried, as tokens or as a hash to verify.
const inputSchema = z.union([
  z.object({ accessToken: z.string().min(20).max(8192), refreshToken: z.string().min(1).max(1024), expiresIn: z.number().int().positive().max(86_400).optional() }).strict(),
  z.object({ tokenHash: z.string().min(10).max(1024), type: z.enum(["email", "magiclink", "email_change", "signup"]) }).strict(),
]);

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await rateLimit(`adopt:${requestIp(request)}`, 10);
    const account = await adoptSession(await readJson(request, inputSchema));
    return NextResponse.json({ account }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
