import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, readJson, requireSameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/sessions";
import { adminRequest } from "@/lib/supabase";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { email } = await readJson(request, z.object({ email: z.email().trim().max(254).transform(s => s.toLowerCase()) }).strict());
    const { user } = await requireUser();
    rateLimit(`waitlist:${user.id}`, 3, 3600_000);
    const response = await adminRequest("waitlist?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: user.id, email }) });
    if (!response.ok) throw new ApiError(503, "WAITLIST_UNAVAILABLE", "We couldn’t save your email. Please try again shortly.");
    return NextResponse.json({ joined: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
