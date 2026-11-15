import type { Metadata } from "next";
import { AccountCard } from "@/components/account-card";
import { ProgressOverview } from "@/components/progress-panel";

export const metadata: Metadata = { title: "Your progress" };

export default function ProgressPage() {
  return (
    <main id="main" className="shell pt-8 lg:pt-16">
      <div className="max-w-2xl">
        <h1 className="display text-2xl sm:text-3xl">Your progress</h1>
        <p className="mt-6 max-w-measure text-lg text-neutral-600">Worked out from the sessions saved to your account.</p>
      </div>
      <ProgressOverview />
      <AccountCard className="mt-16 max-w-3xl lg:mt-24" />
    </main>
  );
}
