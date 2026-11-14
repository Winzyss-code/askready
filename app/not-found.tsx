import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="shell pt-8 lg:pt-16">
      <p className="figure text-3xl text-neutral-300" aria-hidden="true">404</p>
      <h1 className="display mt-4 text-2xl">This page isn’t here.</h1>
      <p className="mt-4 max-w-measure text-lg text-neutral-600">Return to AskReady to find your practice space.</p>
      <ButtonLink href="/" className="mt-8">Return to AskReady<ArrowRight aria-hidden="true" className="size-4" /></ButtonLink>
    </main>
  );
}
