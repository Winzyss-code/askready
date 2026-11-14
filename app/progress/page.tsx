import type { Metadata } from "next";
import { ProgressOverview } from "@/components/progress-panel";

export const metadata: Metadata = { title: "Your progress" };

export default function ProgressPage() {
  return (
    <main id="main" className="shell pt-8 lg:pt-16">
      <div className="max-w-2xl">
        <h1 className="display text-2xl sm:text-3xl">Your progress</h1>
        <p className="mt-6 max-w-measure text-lg text-neutral-600">Worked out from the sessions saved to this browser’s account.</p>
      </div>
      <ProgressOverview />
    </main>
  );
}
