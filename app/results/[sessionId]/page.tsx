import { ResultsView } from "@/components/results-view";

export default async function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ResultsView sessionId={sessionId} />;
}
