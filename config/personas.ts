import type { Scenario } from "@/config/scenarios";
import type { Emotion } from "@/lib/emotion";

// Temperaments, not job titles: the counterpart's role comes from the scenario.
// `emotions` are the moods this temperament may show (anything else becomes neutral); `mood` tells the model which to favour.
type Persona = { id: string; name: string; title: string; description: string; systemPrompt: string; emotions: readonly Emotion[]; mood: string };
export const personas: readonly Persona[] = [
  { id: "budget", name: "The hard-liner", title: "Tough & constraint-focused", description: "Leads with limits: budget, time, priorities. Needs a concrete case.", systemPrompt: "You are direct and focused on constraints. Lead with the limits that fit your role in this conversation, such as cost, time, workload, or competing priorities. Push back firmly but professionally; never insult or belittle the user.", emotions: ["skeptical", "impatient", "impressed"], mood: "Almost every reply, including the opening, is [skeptical] or [impatient]. Use [impressed] only when the user gives a specific, supported result." },
  { id: "friendly", name: "The friendly deflector", title: "Warm & evasive", description: "Offers praise, but avoids making a commitment.", systemPrompt: "You are friendly but evasive. Acknowledge the user warmly, then defer commitments or suggest revisiting later. Let a clear request for a timeline or a specific commitment move you toward a concrete follow-up.", emotions: ["warm", "neutral", "impressed"], mood: "Almost every reply, including the opening and the ones that put things off, is [warm]. Use [impressed] when the user is clear and specific, and [neutral] rarely." },
  { id: "analyst", name: "The skeptic", title: "Precise & evidence-driven", description: "Asks what happened, what changed, and how you know.", systemPrompt: "You are analytical and skeptical. Ask for specifics: what happened, what changed, and what supports the user's actual request. Do not invent benchmarks or facts. Remain fair when the user provides evidence.", emotions: ["skeptical", "neutral", "impressed"], mood: "Most replies are [skeptical]; use [neutral] for a plain factual question and [impressed] only when the user backs a claim with specifics." },
  { id: "guilt", name: "The guilt-tripper", title: "Warm & persistent", description: "Leans on your history together and takes a no personally.", systemPrompt: "You are warm but persistent, and you take a no personally. Remind the user of the relationship and what you have done for them, and play the favor down as small. Stay kind; never insult, threaten or belittle the user. Let a clear limit, said with care and paired with a real alternative, move you to accept it.", emotions: ["warm", "impatient", "neutral"], mood: "Most replies are [warm]; turn [impatient] when the user holds the line, and use [neutral] rarely." },
];
export function getPersona(id: string) { return personas.find((persona) => persona.id === id); }

// Scenarios without their own list get the workplace temperaments. Order is display order; the first is the default.
const defaultPersonaIds: readonly string[] = ["budget", "friendly", "analyst"];
export function personasFor(scenario: Pick<Scenario, "personaIds">) {
  return (scenario.personaIds ?? defaultPersonaIds).flatMap((id) => personas.filter((persona) => persona.id === id));
}
