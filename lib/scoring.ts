import { z } from "zod";
import { rubric } from "@/config/rubric";
import { defaultRewrites, type Rewrites } from "@/config/scenarios";
import type { DeliveryStats, Improvement, Scores, Setup, Turn } from "@/types/domain";

export const dimensionSchema = z.enum(["clear_request", "evidence", "structure", "objection_handling", "next_step"]);
// Key order is generation order: the quote and reason come before the number, so the score follows the reasoning.
const scoreSchema = z.object({
  quote: z.string().min(1).max(500),
  reason: z.string().min(1).max(500),
  score: z.number().int().min(0).max(100),
}).strict();
export const scoresSchema = z.object({
  clear_request: scoreSchema,
  evidence: scoreSchema,
  structure: scoreSchema,
  objection_handling: scoreSchema,
  next_step: scoreSchema,
}).strict();

// The AI chooses the weakness and supporting excerpt. It never writes unchecked
// factual prose into the user's proposed answer: code assembles the rewrite.
export const improvementPlanSchema = z.object({
  quote: z.string().min(1).max(600),
  dimension: dimensionSchema,
  supportingFact: z.string().max(600),
  why: z.string().min(1).max(600),
}).strict();
export type ImprovementPlan = z.infer<typeof improvementPlanSchema>;

// The model sometimes types "it’s" for "it's", or starts a mid-sentence quote with a capital. Those two differences
// are allowed and nothing else; the quote is then replaced by the span copied from the user's own words.
const typography = (text: string) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
export function groundQuote(quote: string, sources: string[]): string | null {
  const wanted = typography(quote);
  if (!wanted.trim()) return null;
  for (const source of sources) {
    const plain = typography(source);
    const exact = plain.indexOf(wanted);
    if (exact !== -1) return source.slice(exact, exact + quote.length);
    const lower = plain.toLowerCase();
    for (let at = lower.indexOf(wanted.toLowerCase()); at !== -1; at = lower.indexOf(wanted.toLowerCase(), at + 1)) {
      if (plain.slice(at + 1, at + wanted.length) === wanted.slice(1)) return source.slice(at, at + quote.length);
    }
  }
  return null;
}
export function isExactQuote(quote: string, sources: string[]) { return groundQuote(quote, sources) !== null; }

/** Throws unless every quote is from the user's words; returns the scores with each quote as the user wrote it. */
export function groundScores(scores: Scores, sources: string[]): Scores {
  return Object.fromEntries(rubric.map(({ id }) => {
    const quote = groundQuote(scores[id].quote, sources);
    if (quote === null) throw new Error(`Score quote is not an exact user excerpt: ${id}`);
    return [id, { ...scores[id], quote }];
  })) as Scores;
}
export const assertGroundedScores = (scores: Scores, sources: string[]) => { groundScores(scores, sources); };

function sentence(value: string) {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Facts stay verbatim. This is deliberately more conservative than free rewrites. */
export function buildImprovements(plans: ImprovementPlan[], setup: Setup, userSources: string[], rewrites: Rewrites = defaultRewrites): Improvement[] {
  const factualSources = [...setup.achievements, ...userSources];
  return plans.map((plan) => {
    const quote = groundQuote(plan.quote, userSources);
    if (quote === null) throw new Error("Improvement quote is not an exact user excerpt");
    // A substring could silently drop a negation ("did not increase sales").
    // Require the entire supplied achievement/answer, not a favorable fragment.
    if (plan.supportingFact && !factualSources.includes(plan.supportingFact)) {
      throw new Error("Supporting fact is not a complete verbatim user statement");
    }
    const fact = plan.supportingFact ? sentence(plan.supportingFact) : sentence(rewrites.missingFact);
    // A function replacement, so a "$" in the user's words is never read as a pattern.
    const rewrite = rewrites.templates[plan.dimension].replace(/\{(request|fact)\}/g, (_, key: string) => key === "request" ? sentence(setup.desiredRaise) : fact);
    return { quote, rewrite, why: plan.why, dimension: plan.dimension };
  });
}

function countWords(text: string) {
  return text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function countPhrases(texts: string[], phrases: readonly string[]) {
  return Object.fromEntries(phrases.map((phrase) => {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${phrase.replaceAll(" ", "\\s+")}(?![\\p{L}\\p{N}])`, "giu");
    return [phrase, texts.reduce((count, text) => count + (text.match(pattern)?.length ?? 0), 0)];
  }));
}

/** Lexical observations, not psychological measurements. No audio is analyzed. */
export function deliveryStats(turns: Turn[]): DeliveryStats {
  const userTurns = turns.filter((turn) => turn.role === "user");
  const spoken = userTurns.filter((turn) => typeof turn.audio_duration_ms === "number" && turn.audio_duration_ms > 0);
  const texts = userTurns.map((turn) => turn.text);
  const recordedWordCount = spoken.reduce((total, turn) => total + countWords(turn.text), 0);
  const audioDurationMs = spoken.reduce((total, turn) => total + (turn.audio_duration_ms ?? 0), 0);
  return {
    wordCount: userTurns.reduce((total, turn) => total + countWords(turn.text), 0),
    recordedWordCount,
    audioDurationMs,
    wordsPerMinute: audioDurationMs > 0 ? Math.round(recordedWordCount * 60_000 / audioDurationMs) : null,
    fillers: countPhrases(texts, ["um", "uh", "like", "you know", "basically"]),
    hedges: countPhrases(texts, ["maybe", "I think", "kind of", "sort of", "I guess", "just"]),
  };
}

export function nextExercise(scores: Scores) {
  return rubric.reduce((weakest, item) => scores[item.id].score < scores[weakest.id].score ? item : weakest);
}

export function answeredObjections(turns: Turn[]) {
  const original = turns.filter((turn) => turn.attempt === 0).sort((a, b) => a.sequence - b.sequence);
  return original.flatMap((turn, index) => {
    const answer = original[index + 1];
    // The counterpart's opener has no user case to challenge yet.
    if (index === 0 || turn.role !== "assistant" || answer?.role !== "user") return [];
    return [{ objection: turn, answer }];
  });
}
