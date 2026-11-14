import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthStatus } from "@/components/auth-status";
import { ComparisonBoard } from "@/components/comparison-board";
import { PracticePreview } from "@/components/practice-preview";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rubric } from "@/config/rubric";
import { scenarios } from "@/config/scenarios";
import { readSupabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

// Illustrative scores for the example on this page, in rubric order. Not a real user's result.
const example = {
  objection: "I appreciate your work. But budgets are frozen.",
  before: "I understand. I just think I’ve been doing a lot this year, so maybe we could look at it again at some point?",
  after: "I hear that budgets are frozen. I’m asking for 10% because I cut weekly reporting from five hours to three and trained two new colleagues. What would you need to see to approve it, and can we set a date next quarter to decide?",
  scores: [[25, 75], [25, 75], [50, 75], [25, 75], [0, 100]],
};
const steps = [
  { title: "Rehearse the conversation", text: "Bring your achievements and your ask. Speak or type to a manager with a point of view." },
  { title: "Find what to say better", text: "See your own words beside a clearer version, with a reason for each change." },
  { title: "Try the hard part again", text: "Answer the same objection twice. Compare both attempts using the same five criteria." },
];

export default function HomePage() {
  const { configured } = readSupabaseConfig();
  const liveScenario = scenarios.find((scenario) => scenario.live);
  const practiceHref = liveScenario ? `/practice/${liveScenario.id}` : "/pricing";
  const rows = rubric.map((dimension, index) => ({ label: dimension.label, before: example.scores[index][0], after: example.scores[index][1] }));
  const mean = (side: 0 | 1) => Math.round(example.scores.reduce((sum, pair) => sum + pair[side], 0) / example.scores.length);
  const sectionTitle = "display text-xl lg:text-2xl";

  return (
    <main id="main" className="shell">
      <section className="grid items-center gap-x-16 gap-y-12 pt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:pt-16" aria-labelledby="hero-heading">
        <div>
          <h1 id="hero-heading" className="display text-2xl sm:text-3xl">Practice asking for a raise <span className="mark">before the real conversation.</span></h1>
          <p className="mt-6 max-w-measure text-lg text-neutral-600">Talk it through with an AI manager who pushes back. Get specific coaching on your own words, then try your hardest answer again.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href={practiceHref}>Start practicing<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
            <span className="text-sm text-neutral-600">One free rehearsal a day. No signup form.</span>
          </div>
          <div className="mt-6 max-w-measure"><AuthStatus configured={configured} /></div>
        </div>
        <PracticePreview />
      </section>

      <section className="mt-24 grid gap-x-16 gap-y-8 lg:mt-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="how-heading">
        <div>
          <h2 id="how-heading" className={sectionTitle}>How a rehearsal works</h2>
          <p className="mt-4 max-w-measure text-neutral-600">A better answer takes practice, so the hardest moment comes round twice.</p>
        </div>
        <ol>
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-6 border-t border-neutral-300 py-6 last:border-b">
              <span aria-hidden="true" className="figure w-8 shrink-0 text-xl">{index + 1}</span>
              <div><h3 className="text-lg font-semibold">{step.title}</h3><p className="mt-1 text-neutral-600">{step.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 lg:mt-32" aria-labelledby="example-heading">
        <h2 id="example-heading" className={sectionTitle}>One objection. Two answers.</h2>
        <p className="mt-4 max-w-measure text-neutral-600">An illustrative example we wrote to show what a comparison looks like. Yours uses your own words and your own case.</p>
        <Card className="mt-8 p-5 sm:p-10">
          <p className="text-sm font-semibold text-neutral-500">The manager said</p>
          <blockquote className="mb-8 mt-1 text-lg font-medium">“{example.objection}”</blockquote>
          <ComparisonBoard id="example" answers={{ before: example.before, after: example.after }} rows={rows} average={{ before: mean(0), after: mean(1) }} caption="Example scores. Real scores are coaching estimates on these same five criteria, not a prediction of your manager’s decision." />
        </Card>
      </section>

      <section className="mt-24 grid gap-x-16 gap-y-8 lg:mt-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="skills-heading">
        <div>
          <h2 id="skills-heading" className={sectionTitle}>Conversations worth preparing for.</h2>
          <p className="mt-4 max-w-measure text-neutral-600">Start with your raise. More ways to practice are on the way.</p>
        </div>
        <ul>
          {scenarios.map((scenario) => (
            <li key={scenario.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-neutral-300 py-5 last:border-b">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className={scenario.live ? "text-lg font-semibold" : "text-lg font-semibold text-neutral-500"}>{scenario.title}</h3><Badge tone={scenario.live ? "marker" : "outline"}>{scenario.live ? "Available now" : "Coming soon"}</Badge></div>
                <p className="mt-1 text-neutral-600">{scenario.description}</p>
              </div>
              {scenario.live && <Link className="link flex min-h-11 items-center gap-2" href={`/practice/${scenario.id}`}>Practice this conversation<ArrowRight aria-hidden="true" className="size-4" /></Link>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-24 rounded-lg bg-ink p-6 text-paper sm:p-10 lg:mt-32" aria-labelledby="pricing-heading">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 id="pricing-heading" className={sectionTitle}>Free covers a full rehearsal.</h2>
            <p className="mt-4 max-w-measure text-neutral-200">Coaching, the retry and the comparison are all part of Free. Pro is planned, and it isn’t for sale yet.</p>
            <ButtonLink variant="accent" className="mt-8" href="/pricing">Compare Free and Pro</ButtonLink>
          </div>
          <dl className="grid content-start gap-6 sm:grid-cols-2">
            <div className="border-t border-neutral-500 pt-4"><dt className="font-semibold">Free</dt><dd className="mt-2"><span className="figure text-2xl">$0</span><span className="mt-2 block text-sm text-neutral-300">One rehearsal a day, with coaching and one retry.</span></dd></div>
            <div className="border-t border-neutral-500 pt-4"><dt className="font-semibold">Pro <span className="ml-1 text-sm font-normal text-neutral-300">waitlist only</span></dt><dd className="mt-2"><span className="figure text-2xl">$12.99</span><span className="mt-2 block text-sm text-neutral-300">Planned monthly price. No payment is taken today.</span></dd></div>
          </dl>
        </div>
      </section>

      <section className="mt-16 max-w-measure" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="font-semibold">Your rehearsal, your words.</h2>
        <p className="mt-3 text-sm text-neutral-600">Voice and conversation content are sent to OpenAI to run the rehearsal and generate coaching. Transcripts and results are saved in Supabase under your anonymous account; recordings are not stored by AskReady. Use only workplace details you are comfortable sharing.</p>
        <p className="mt-2 text-sm text-neutral-600">This browser remembers your account. Clearing cookies or switching browsers means losing access to your results. Coaching is an estimate, not a prediction of what your manager will decide.</p>
      </section>
    </main>
  );
}
