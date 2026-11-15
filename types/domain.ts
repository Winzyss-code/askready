import type { Emotion } from "@/lib/emotion";
export type Setup = { role: string; desiredRaise: string; achievements: [string, string]; objection: string };
export type Dimension = "clear_request" | "evidence" | "structure" | "objection_handling" | "next_step";
export type Score = { score: number; quote: string; reason: string };
export type Scores = Record<Dimension, Score>;
// `dimension` is saved from this version on; older saved coaching has none.
export type Improvement = { quote: string; rewrite: string; why: string; dimension?: Dimension };
export type DeliveryStats = {
  wordCount: number; recordedWordCount: number; audioDurationMs: number;
  wordsPerMinute: number | null; fillers: Record<string, number>; hedges: Record<string, number>;
};
// `emotion` is the counterpart's saved mood; absent before migration 003, and null for user turns and older replies.
export type Turn = { id: string; session_id: string; role: "user" | "assistant"; text: string; audio_duration_ms: number | null; attempt: number; sequence: number; created_at: string; request_id?: string | null; emotion?: Emotion | null };
export type Focus = { objectionTurnId: string; answerTurnId: string; objection: string; answer: string; baselineScores: Scores };
export type Session = { id: string; user_id: string; scenario_id: string; persona_id: string; setup: Setup; created_at: string; status: "practice" | "feedback" | "complete" };
export type Feedback = { id: string; session_id: string; attempt: number; scores: Scores; improvements: Improvement[]; delivery_stats: DeliveryStats; focus: Focus | null; created_at: string };
// `reaction` comes with a freshly generated counterpart reply, so its face shows before the saved mood is read back.
export type SessionBundle = { session: Session; turns: Turn[]; feedback: Feedback[]; reaction?: { turnId: string; emotion: Emotion } };
