import type { TrackId } from "@/config/tracks";
import type { Dimension } from "@/types/domain";

// Every scenario is an ask met with pushback: the counterpart opens, the user makes a case, the
// counterpart raises the objection the user expects. The shared rubric and scoring rely on that shape.
export type Lesson = {
  technique: string; summary: string;
  steps: { title: string; text: string; dimension: Dimension }[];
  weak: string; strong: string;
};
export type Scenario = {
  id: string; trackId: TrackId; title: string; description: string; live: boolean;
  userRole: string;                               // used in prompts
  counterpart: { role: string; label: string };   // role is used in prompts, label in the UI
  personaIds?: string[];                          // temperaments that fit this counterpart; the workplace set when omitted
  opening: string;                                // prompt directive for the counterpart's first line
  systemPrompt: string;
  fields: {
    role?: { label: string; placeholder: string };  // "Your job role" when omitted
    request: { label: string; placeholder: string };
    facts: { legend: string; hint: string; labels: [string, string]; placeholders: [string, string] };
    objection: { label: string; hint: string; placeholder: string };
  };
  lesson?: Lesson;                                // human-written; required before a scenario goes live
};

export const scenarios: Scenario[] = [
  {
    id: "raise", trackId: "ask", title: "Ask for a raise", description: "Make your case, face the pushback, and leave with a next step.", live: true,
    userRole: "an employee asking their manager for a raise",
    counterpart: { role: "the user's manager, who decides whether to support the raise", label: "Manager" },
    opening: "Invite them to make their case in one short question.",
    systemPrompt: "This is a compensation conversation. Challenge whether the user's actual achievements and responsibilities justify their requested raise. Use their likely objection and realistic concerns such as budget constraints, timing, or what results justify the request. Do not promise an actual raise.",
    fields: {
      request: { label: "What raise are you asking for?", placeholder: "A 10% raise, from $90,000 to $99,000" },
      facts: {
        legend: "What have you done to earn it?", hint: "Give your manager something real to respond to.",
        labels: ["Achievement 1", "Achievement 2"],
        placeholders: ["What improved because of your work? Include a number if you have one.", "Another contribution, result, or responsibility you’ve taken on."],
      },
      objection: { label: "What might your manager say?", hint: "The objection you’re most worried about. Your manager will raise it.", placeholder: "We don’t have the budget right now." },
    },
    lesson: {
      technique: "Ask, proof, next step",
      summary: "A vague ask is easy to wave away. Say the number, back it with two results, and don’t leave without a date.",
      steps: [
        { title: "Say the number", text: "Open with the exact raise you want in one sentence. Then stop talking.", dimension: "clear_request" },
        { title: "Give two proofs", text: "Name two results you can support. Results, not effort.", dimension: "evidence" },
        { title: "Ask for the next step", text: "If the answer isn’t yes, ask what would make it a yes, and by when.", dimension: "next_step" },
      ],
      weak: "I’ve been working really hard this year, so I was hoping we could maybe look at my pay at some point?",
      strong: "I’m asking for a 10% raise. I cut weekly reporting from five hours to three and trained two new colleagues. What would you need to see to approve it, and when can we decide?",
    },
  },
  {
    id: "promotion", trackId: "ask", title: "Ask for a bigger role", description: "Show you already work at the next level, and ask for the title.", live: false,
    userRole: "an employee asking their manager for a promotion or a bigger role",
    counterpart: { role: "the user's manager, who decides whether to support the promotion", label: "Manager" },
    opening: "Invite them to make their case in one short question.",
    systemPrompt: "This is a promotion conversation. Challenge whether the user's actual results and responsibilities show they already work at the level they are asking for. Use their likely objection and realistic concerns such as timing, open positions, or readiness. Do not promise an actual promotion.",
    fields: {
      request: { label: "What role are you asking for?", placeholder: "Senior analyst, leading the reporting team" },
      facts: {
        legend: "What shows you’re ready?", hint: "Two results or responsibilities that show you already work at that level.",
        labels: ["Proof 1", "Proof 2"],
        placeholders: ["Something you own today that belongs to the bigger role.", "A result that others relied on."],
      },
      objection: { label: "What might your manager say?", hint: "The objection you’re most worried about. Your manager will raise it.", placeholder: "There’s no open position at that level right now." },
    },
  },
  {
    id: "offer", trackId: "ask", title: "Negotiate a job offer", description: "Ask for more before you sign, without losing the offer.", live: false,
    userRole: "a candidate negotiating a job offer they have received",
    counterpart: { role: "the hiring manager who made the user a job offer", label: "Hiring manager" },
    opening: "Say you’re glad to talk about the offer and ask what’s on their mind, in one short question.",
    systemPrompt: "This is a job offer negotiation. You want the candidate to accept, but you defend the offer as it stands. Use their likely objection and realistic concerns such as salary bands, internal fairness, or timing. Do not invent figures, and do not promise changes to the offer.",
    fields: {
      request: { label: "What are you asking for?", placeholder: "A base salary of $105,000 instead of $95,000" },
      facts: {
        legend: "What backs your number?", hint: "Two things you bring that justify the ask.",
        labels: ["Reason 1", "Reason 2"],
        placeholders: ["Experience or a result that matches what the role needs.", "Another reason you can support."],
      },
      objection: { label: "What might they say?", hint: "The pushback you’re most worried about. They will raise it.", placeholder: "This is already the top of our range for the role." },
    },
  },
  {
    id: "pushback", trackId: "ground", title: "Say no to extra work", description: "Protect your priorities without sounding like you don’t care.", live: true,
    userRole: "an employee telling their manager they can't take on additional work as asked",
    counterpart: { role: "the user's manager, who wants them to take on more work", label: "Manager" },
    opening: "Say you heard they wanted to talk about the extra work you asked them to take on, and ask what’s on their mind, in one short question. Do not describe the work.",
    systemPrompt: "This is a workload conversation. You want the extra work done. Press on urgency and what the team needs, using the user's likely objection. Become willing to trade off priorities or timing once the user names specific commitments and offers a concrete choice. Never invent deadlines, projects, or company facts.",
    fields: {
      request: { label: "What do you need instead?", placeholder: "Move the vendor audit to next sprint" },
      facts: {
        legend: "What’s already on your plate?", hint: "Two real commitments your manager can weigh against the new work.",
        labels: ["Commitment 1", "Commitment 2"],
        placeholders: ["What you’re working on now, and when it’s due.", "Another commitment that would slip."],
      },
      objection: { label: "What might your manager say?", hint: "The pushback you’re most worried about. Your manager will raise it.", placeholder: "Everyone is stretched. I need you to make it work." },
    },
    lesson: {
      technique: "Goal, trade-off, choice",
      summary: "A bare no sounds like you don’t care. A trade-off sounds like you’re protecting the work.",
      steps: [
        { title: "Agree with the goal", text: "Start with what you both want, so the no isn’t personal.", dimension: "objection_handling" },
        { title: "Name the trade-off", text: "Say what is already on your plate and what would slip. Facts, not feelings.", dimension: "evidence" },
        { title: "Offer a choice", text: "Ask which one should move, or when you could take it on.", dimension: "next_step" },
      ],
      weak: "I guess I can try to fit it in, I’m just pretty busy right now.",
      strong: "I want the launch to go well too. I’m already on the migration and the Q3 report, both due Friday. If I take this on, one of them slips. Which should move, or can this wait until Monday?",
    },
  },
  {
    id: "feedback", trackId: "ground", title: "Give difficult feedback", description: "Say what needs to change with clarity and care.", live: true,
    userRole: "someone giving difficult feedback to a teammate",
    counterpart: { role: "the user's teammate, who is receiving difficult feedback about their work", label: "Teammate" },
    opening: "As a teammate who was asked for a quick chat, ask what they wanted to talk about in one short, casual question.",
    systemPrompt: "This is a feedback conversation between peers. React the way a real colleague would: minimise, explain, or point to other causes, using the reaction the user expects. You are a peer, not a manager: you do not approve budgets or decide priorities. Stay professional. Concede and agree to something concrete once the user gives a specific example and a clear request. Never invent project facts.",
    fields: {
      request: { label: "What do you need them to change?", placeholder: "Send your section of the report by Thursday noon" },
      facts: {
        legend: "What happened, specifically?", hint: "Two concrete moments. Dates and details beat “always” and “never”.",
        labels: ["Example 1", "Example 2"],
        placeholders: ["What happened, and when?", "A second moment, or what it caused for you or the team."],
      },
      objection: { label: "How might they react?", hint: "The reaction you’re most worried about. Your teammate will respond this way.", placeholder: "I’ve been swamped, and nobody told me it was urgent." },
    },
    lesson: {
      technique: "Example, impact, request",
      summary: "Feedback lands when it’s about one specific moment, not about the person.",
      steps: [
        { title: "One specific example", text: "Describe what happened, once, with a detail. No “always” or “never”.", dimension: "evidence" },
        { title: "The impact", text: "Say what it caused for you or the team. Keep it factual.", dimension: "structure" },
        { title: "A clear request", text: "Say what you need to change, and agree when you’ll check in.", dimension: "clear_request" },
      ],
      weak: "You’re always late with stuff and it’s kind of becoming a problem for everyone.",
      strong: "Your section of the client report came in two days after the deadline last week, and I rewrote the summary overnight. I need your part by Thursday noon. Can we agree on that and check in next Friday?",
    },
  },
  {
    id: "boundary", trackId: "ground", title: "Set a boundary with a friend or family member", description: "Say no to the favor that keeps coming back, and keep the relationship.", live: true,
    userRole: "someone setting a boundary with a close friend or family member who keeps asking them for the same favor",
    counterpart: { role: "the user's close friend or family member, who keeps asking the user for the same favor and wants the answer to stay yes", label: "Friend or relative" },
    personaIds: ["guilt", "friendly"],
    opening: "As a close friend or relative who was asked for a chat, say hi warmly and ask what’s up in one short, casual question. Do not mention the favor yet.",
    systemPrompt: "This is a personal conversation, not a work one. You are the one who keeps asking for the favor; the user is the one saying no. The setup is written from the user's side: the boundary, the reasons and the inconvenience are theirs, never yours, so never retell their reasons as your own complaints. You are not the user's manager, boss, colleague or client: never approve, prioritise, set deadlines or talk about budgets, projects or the team, and bring up work only if the user does. Talk like a real friend or relative: casual, warm, a little hurt by a no. Casual still means at most three sentences in total, so never string short exclamations together (not “Oh. Wow. Okay.”); fold a reaction into one sentence. Push back with the reaction the user expects, such as reminding them what you have done for them or calling it a small favor. Stay kind: no insults, threats or pressure beyond ordinary guilt. Accept the boundary and agree to something concrete once the user says clearly what they will and won't do and offers an alternative. Never invent shared history, family facts or events the user did not mention.",
    fields: {
      role: { label: "Who are you to them?", placeholder: "Their older sister" },
      request: { label: "What’s your boundary?", placeholder: "I can’t lend you my car on weekends anymore" },
      facts: {
        legend: "Why now?", hint: "Two real moments or reasons they can’t easily wave away.",
        labels: ["Reason 1", "Reason 2"],
        placeholders: ["What happened last time, and when?", "What it costs you: time, money or something you missed."],
      },
      objection: { label: "What might they say?", hint: "The reaction you’re most worried about. They will say it.", placeholder: "After everything I’ve done for you? It’s one weekend." },
    },
    lesson: {
      technique: "Care, limit, alternative",
      summary: "A boundary lands when they hear two things: you care about them, and the answer is still no.",
      steps: [
        { title: "Say you care", text: "Start with the relationship, so the no isn’t a rejection of them.", dimension: "objection_handling" },
        { title: "State the limit", text: "Say plainly what you won’t do anymore. One sentence, no long apology.", dimension: "clear_request" },
        { title: "Offer what you can do", text: "Give one real alternative, and say when it applies.", dimension: "next_step" },
      ],
      weak: "I mean, it’s fine, I guess. It’s just been kind of a lot lately…",
      strong: "I love helping you, and I’m not lending the car on weekends anymore. Last month it came back empty twice. I can drive you to the station on Saturday mornings. Would that work?",
    },
  },
  {
    id: "credit", trackId: "ground", title: "Speak up when someone takes credit", description: "Name what happened and ask for it to be put right.", live: false,
    userRole: "someone telling a coworker that their work was presented without credit",
    counterpart: { role: "the user's coworker, who presented the user's work without crediting them", label: "Coworker" },
    opening: "As a coworker who was asked for a quick chat, ask what they wanted to talk about in one short, casual question.",
    systemPrompt: "This is a conversation between peers about credit for work. React the way a real colleague would: downplay it, call it a team effort, or say it was not intentional, using the reaction the user expects. Stay professional. Agree to something concrete once the user names what happened and makes a clear request. Never invent project facts.",
    fields: {
      request: { label: "What do you need them to do?", placeholder: "Tell the team I built the forecast model" },
      facts: {
        legend: "What happened, specifically?", hint: "Two concrete moments. Details beat impressions.",
        labels: ["Example 1", "Example 2"],
        placeholders: ["What was presented, and where?", "What you did that went unmentioned."],
      },
      objection: { label: "How might they react?", hint: "The reaction you’re most worried about. Your coworker will respond this way.", placeholder: "It was a team effort. I didn’t think it mattered who presented." },
    },
  },
];
export const liveScenarios = scenarios.filter((scenario) => scenario.live);
export function getScenario(id: string) { return scenarios.find((scenario) => scenario.id === id); }
