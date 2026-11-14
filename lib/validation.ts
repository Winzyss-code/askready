import { z } from "zod";
export const setupSchema = z.object({ role: z.string().trim().min(2).max(120), desiredRaise: z.string().trim().min(2).max(200), achievements: z.tuple([z.string().trim().min(5).max(600), z.string().trim().min(5).max(600)]), objection: z.string().trim().min(3).max(400) }).strict();
export const startSchema = z.object({ action: z.literal("start"), scenarioId: z.string().max(80), personaId: z.string().max(80), setup: setupSchema, requestId: z.uuid() }).strict();
export const replySchema = z.object({ action: z.literal("reply"), sessionId: z.uuid(), text: z.string().trim().min(1).max(3000), audioDurationMs: z.number().int().min(1).max(180000).nullable().optional(), requestId: z.uuid(), attempt: z.union([z.literal(0), z.literal(1)]) }).strict();
export const turnInputSchema = z.discriminatedUnion("action", [startSchema, replySchema]);
export const feedbackInputSchema = z.object({ sessionId: z.uuid(), attempt: z.union([z.literal(0), z.literal(1)]) }).strict();
