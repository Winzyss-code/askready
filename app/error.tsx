"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="shell pt-8 lg:pt-16">
      <CircleAlert aria-hidden="true" className="size-8 text-error" />
      <h1 className="display mt-4 max-w-2xl text-2xl">We couldn’t open your practice space.</h1>
      <p className="mt-4 max-w-measure text-lg text-neutral-600">Please try again in a moment. Anything you already saved is still there.</p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="link flex min-h-11 items-center">Return home</Link>
      </div>
    </main>
  );
}
