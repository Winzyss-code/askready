import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getScenario, liveScenarios } from "@/config/scenarios";
import { PracticeFlow } from "@/components/practice-flow";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export default async function PracticePage({ params, searchParams }: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<{ session?: string; retry?: string; example?: string }>;
}) {
  const { scenarioId } = await params;
  const query = await searchParams;
  const scenario = getScenario(scenarioId);
  if (!scenario) notFound();
  if (!scenario.live) return (
    <main id="main" className="shell pb-16 pt-8 lg:pt-16">
      <h1 className="display text-2xl sm:text-3xl">{scenario.title}</h1>
      <Badge tone="outline" className="mt-6">Coming soon</Badge>
      <p className="mt-4 max-w-measure text-lg text-neutral-600">This scenario is coming soon. Available to practice today: {liveScenarios.map((live) => live.title.toLowerCase()).join(", ")}.</p>
      <ButtonLink href="/" className="mt-8">Explore available practice<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
    </main>
  );
  return <PracticeFlow scenario={scenario} initialSessionId={query.session} retryRequested={query.retry === "1"} exampleRequested={query.example === "1"} />;
}
