import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { buildProgress, type ProgressSession } from "@/lib/progress";
import { requireUser, userQuery } from "@/lib/sessions";
import type { Scores, Session } from "@/types/domain";
export const runtime = "nodejs";

// Progress covers the user's 100 most recent sessions. With one session a day that is over three months.
const LIMIT = 100;
type Row = Pick<Session, "id" | "scenario_id" | "status" | "created_at">;

async function loadSessions(token: string): Promise<ProgressSession[]> {
  try {
    const rows = await userQuery<(Row & { feedback: { attempt: number; scores: Scores }[] })[]>(`sessions?select=id,scenario_id,status,created_at,feedback(attempt,scores)&feedback.attempt=eq.0&order=created_at.desc&limit=${LIMIT}`, token);
    return rows.map(({ feedback, ...session }) => ({ ...session, scores: feedback[0]?.scores ?? null }));
  } catch {
    // The embed needs PostgREST to know the feedback → sessions relationship. Fall back to two plain queries.
    const rows = await userQuery<Row[]>(`sessions?select=id,scenario_id,status,created_at&order=created_at.desc&limit=${LIMIT}`, token);
    if (rows.length === 0) return [];
    const feedback = await userQuery<{ session_id: string; scores: Scores }[]>(`feedback?select=session_id,scores&attempt=eq.0&session_id=in.(${rows.map((row) => row.id).join(",")})`, token);
    const scores = new Map(feedback.map((item) => [item.session_id, item.scores]));
    return rows.map((session) => ({ ...session, scores: scores.get(session.id) ?? null }));
  }
}

export async function GET() {
  try {
    const { accessToken } = await requireUser();
    return NextResponse.json({ progress: buildProgress(await loadSessions(accessToken)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
