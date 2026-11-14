"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";

export function BrandMark() {
  return (
    <span aria-hidden="true" className="flex size-7 items-center justify-center gap-0.5 rounded-full bg-ink">
      <span className="h-1.5 w-0.5 rounded-full bg-marker" /><span className="h-3 w-0.5 rounded-full bg-marker" /><span className="h-2 w-0.5 rounded-full bg-marker" />
    </span>
  );
}

/** Marketing pages get the full header. Practice keeps only the way home, so nothing competes with the conversation. */
export function SiteHeader({ practiceHref }: { practiceHref: string }) {
  const focused = usePathname().startsWith("/practice");
  return (
    <header className="shell flex min-h-16 items-center justify-between gap-4 py-2">
      <Link href="/" aria-label="AskReady home" className="display flex min-h-11 items-center gap-2 rounded-sm text-lg">
        <BrandMark />AskReady
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-2 text-sm sm:gap-4">
        <Link href="/pricing" className="flex min-h-11 items-center rounded-sm px-2 font-semibold text-neutral-600 transition-colors hover:text-ink">Pricing</Link>
        {!focused && <ButtonLink href={practiceHref} size="sm" className="max-sm:hidden">Start today’s session</ButtonLink>}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  if (usePathname().startsWith("/practice")) return null;
  return (
    <footer className="shell mt-24">
      <div className="flex flex-col justify-between gap-2 border-t border-neutral-200 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center">
        <p>AskReady. Say the hard thing at work, after you’ve practiced it.</p>
        <Link href="/pricing" className="link flex min-h-11 items-center self-start text-neutral-600">Free &amp; Pro</Link>
      </div>
    </footer>
  );
}
