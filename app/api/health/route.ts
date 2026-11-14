import { NextResponse } from "next/server";
import { readSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const { configured } = readSupabaseConfig();
  return NextResponse.json({ status: configured ? "configured" : "needs_configuration", checkpoint: 1 }, {
    status: configured ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
