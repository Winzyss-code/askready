export type Scenario = {
  id: string; title: string; description: string; live: boolean;
  requestLabel: string; requestPlaceholder: string; systemPrompt: string;
};
export const scenarios: Scenario[] = [
  { id: "raise", title: "Ask for a raise", description: "Make your case, face the pushback, and leave with a next step.", live: true, requestLabel: "What raise are you asking for?", requestPlaceholder: "A 10% raise, from $90,000 to $99,000", systemPrompt: "This is a compensation conversation. Challenge whether the employee's actual achievements and responsibilities justify their requested raise. Use their likely objection and realistic budget, timing, or evidence concerns. Do not promise an actual raise." },
  { id: "pushback", title: "Push back on your manager", description: "Set a boundary without losing the working relationship.", live: false, requestLabel: "What change are you asking for?", requestPlaceholder: "Agree which work can wait until next week", systemPrompt: "Rehearse a professional disagreement over priorities and workload." },
  { id: "feedback", title: "Give difficult feedback", description: "Say what needs to change with clarity and care.", live: false, requestLabel: "What change are you asking for?", requestPlaceholder: "Deliver agreed work on time", systemPrompt: "Rehearse giving constructive but difficult workplace feedback." },
];
export function getScenario(id: string) { return scenarios.find((scenario) => scenario.id === id); }
