import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/sessions";
import { accountOf } from "@/lib/supabase";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { user } = await requireUser();
    return NextResponse.json({ account: accountOf(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
