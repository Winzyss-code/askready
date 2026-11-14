import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { scenarios } from "@/config/scenarios";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth"], variable: "--font-bricolage", display: "swap" });
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AskReady — Practice asking for a raise", template: "%s · AskReady" },
  description: "Rehearse your raise conversation, get specific coaching, and try your hardest answer again.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const practiceHref = `/practice/${scenarios.find((scenario) => scenario.live)?.id ?? "raise"}`;
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#main" className="btn btn-primary sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Skip to content</a>
        <SiteHeader practiceHref={practiceHref} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
