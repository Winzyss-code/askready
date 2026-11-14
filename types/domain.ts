import type { Emotion } from "@/lib/emotion";
export type Setup = { role: string; desiredRaise: string; achievements: [string, string]; objection: string };
export type Dimension = "clear_request" | "evidence" | "structure" | "objection_handling" | "next_step";
export type Score = { score: number; quote: string; reason: string };
export type Scores = Record<Dimension, Score>;
export type Improvement = { quote: string; rewrite: string; why: string };
export type DeliveryStats = {
  wordCount: number; recordedWordCount: number; audioDurationMs: number;
  wordsPerMinute: number | null; fillers: Record<string, number>; hedges: Record<string, number>;
};
export type Turn = { id: string; session_id: string; role: "user" | "assistant"; text: string; audio_duration_ms: number | null; attempt: number; sequence: number; created_at: string; request_id?: string | null };
export type Focus = { objectionTurnId: string; answerTurnId: string; objection: string; answer: string; baselineScores: Scores };
export type Session = { id: string; user_id: string; scenario_id: string; persona_id: string; setup: Setup; created_at: string; status: "practice" | "feedback" | "complete" };
export type Feedback = { id: string; session_id: string; attempt: number; scores: Scores; improvements: Improvement[]; delivery_stats: DeliveryStats; focus: Focus | null; created_at: string };
// `reaction` comes only with a freshly generated counterpart reply. Moods are not stored, so a reloaded reply is neutral.
export type SessionBundle = { session: Session; turns: Turn[]; feedback: Feedback[]; reaction?: { turnId: string; emotion: Emotion } };
