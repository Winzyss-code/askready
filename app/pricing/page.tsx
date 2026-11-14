import type { Metadata } from "next";
import { Check, CircleDashed } from "lucide-react";
import { WaitlistForm } from "@/components/waitlist-form";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FreeAllowance, PRO_PLANNED_PRICE } from "@/config/plans";
import { liveScenarios } from "@/config/scenarios";

export const metadata: Metadata = { title: "Pricing" };

const included = [
  `${FreeAllowance}, start to finish: technique, rehearsal, coaching, retry and comparison`,
  "Every conversation that is available today",
  "Skill levels and days in a row",
  "Voice or text",
];
// Plans, not features. Nothing in this list exists yet.
const planned = [
  "Unlimited sessions a day, for the night before a real conversation",
  "Every track and conversation as it launches",
  "Tougher counterparts and longer conversations",
  "Your full progress history",
];

export default function PricingPage() {
  const practiceHref = `/practice/${liveScenarios[0]?.id ?? "raise"}`;
  const unit = "ml-2 font-sans text-base font-normal tracking-normal text-neutral-500";
  return (
    <main id="main" className="shell pt-8 lg:pt-16">
      <div className="max-w-2xl">
        <h1 className="display text-2xl sm:text-3xl">A full session is free, every day.</h1>
        <p className="mt-6 max-w-measure text-lg text-neutral-600">Free is the whole product at a daily pace. Pro is planned for the days when one session isn’t enough. You can’t buy it yet, but you can tell us you’d want it.</p>
      </div>
      <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
        <Card as="section" className="p-6 sm:p-8" aria-labelledby="free-heading">
          <div className="flex min-h-8 items-center"><h2 id="free-heading" className="display text-xl">Free</h2></div>
          <p className="figure mt-6 text-2xl">$0<span className={unit}>/ month</span></p>
          <p className="mt-4 text-neutral-600">One conversation a day, from the technique to a stronger second attempt.</p>
          <h3 className="mt-8 text-sm font-semibold">What you get today</h3>
          <ul className="mt-3 space-y-3">{included.map((item) => <li key={item} className="flex gap-3"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} />{item}</li>)}</ul>
          <ButtonLink href={practiceHref} className="mt-8 w-full">Start practicing free</ButtonLink>
          <p className="mt-4 text-xs text-neutral-500">The free session resets at midnight UTC. Your anonymous account is tied to this browser.</p>
        </Card>
        <Card as="section" className="p-6 sm:p-8" aria-labelledby="pro-heading">
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-3"><h2 id="pro-heading" className="display text-xl">Pro</h2><Badge tone="outline">Waitlist only</Badge></div>
          <p className="figure mt-6 text-2xl">{PRO_PLANNED_PRICE}<span className={unit}>/ month planned</span></p>
          <p className="mt-4 text-neutral-600">For the week you have a real conversation coming and want to run it more than once a day. Pro is not available to purchase yet.</p>
          <h3 className="mt-8 text-sm font-semibold">What we’re planning</h3>
          <ul className="mt-3 space-y-3 text-neutral-600">{planned.map((item) => <li key={item} className="flex gap-3"><CircleDashed aria-hidden="true" className="mt-1 size-4 shrink-0 text-neutral-400" />{item}</li>)}</ul>
          <WaitlistForm />
        </Card>
      </div>
      <section className="mt-16 max-w-measure" aria-labelledby="pricing-note-heading">
        <h2 id="pricing-note-heading" className="font-semibold">Coaching is part of Free.</h2>
        <p className="mt-3 text-sm text-neutral-600">You can finish a rehearsal, see your coaching, retry an objection, and compare both answers without joining the waitlist. Joining tells us you’re interested in Pro. It does not start a subscription, charge anything, or turn on any feature.</p>
      </section>
    </main>
  );
}
