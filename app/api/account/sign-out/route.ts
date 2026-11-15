import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/sessions";
import { accountOf, signOut } from "@/lib/supabase";
export const runtime = "nodejs";

/** Only a saved account can sign out: signing out an anonymous one would throw its progress away for good. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await readJson(request, z.object({}).strict());
    const { user, accessToken } = await requireUser();
    if (accountOf(user).anonymous) throw new ApiError(409, "NOT_SAVED", "Save your progress to an email before signing out, or it can’t be recovered.");
    await signOut(accessToken);
    return NextResponse.json({ signedOut: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
