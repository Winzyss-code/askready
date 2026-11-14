import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse } from "@/lib/api";
import { requireUser, userQuery } from "@/lib/sessions";
import type { Session } from "@/types/domain";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const scenario = z.string().regex(/^[a-z0-9-]{1,80}$/).safeParse(new URL(request.url).searchParams.get("scenarioId"));
    if (!scenario.success) throw new ApiError(400, "INVALID_INPUT", "Choose a valid scenario.");
    const { accessToken } = await requireUser();
    const sessions = await userQuery<Session[]>(`sessions?scenario_id=eq.${scenario.data}&order=created_at.desc&limit=10&select=*`, accessToken);
    return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
