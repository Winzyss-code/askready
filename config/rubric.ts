import type { Dimension } from "@/types/domain";
export const rubric: { id: Dimension; label: string; description: string; exercise: string }[] = [
  { id: "clear_request", label: "Clear request", description: "States the desired outcome explicitly and specifically.", exercise: "Say the raise you want in one direct sentence, then stop." },
  { id: "evidence", label: "Evidence", description: "Connects relevant, specific achievements to the request.", exercise: "Explain two achievements with measurable results. Use only numbers you can support." },
  { id: "structure", label: "Structure", description: "Presents an organized, concise answer.", exercise: "Practice a 45-second answer: your request, two reasons, then one next step." },
  { id: "objection_handling", label: "Objection handling", description: "Addresses the manager's actual concern with a relevant response.", exercise: "Name the manager's concern, address it with a fact, and propose a practical way forward." },
  { id: "next_step", label: "Next step", description: "Asks for a decision, timeline, or concrete follow-up.", exercise: "Close with a specific follow-up date and ask what needs to happen before then." },
];
export const scoreAnchors = "Use the same anchors for all attempts: 0=absent or contradictory; 25=vague attempt; 50=partly clear but missing key detail; 75=clear and relevant with a minor gap; 100=explicit, specific and well-supported. Intermediate integers are allowed. Score only observable wording, never personality, accent, identity or internal confidence.";
