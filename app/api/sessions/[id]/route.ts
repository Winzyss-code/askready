import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse } from "@/lib/api";
import { loadSession, requireUser } from "@/lib/sessions";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const parsed = z.uuid().safeParse((await context.params).id);
    if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "The session link is invalid.");
    const { accessToken } = await requireUser();
    return NextResponse.json(await loadSession(parsed.data, accessToken), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
