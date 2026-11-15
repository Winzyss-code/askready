"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { Dimension } from "@/types/domain";
import { cx } from "@/lib/cx";

const pad = (value: number) => String(value).padStart(2, "0");

/** Tomorrow at about this time of day (rounded up to the half hour), in the visitor's own clock. */
function tomorrow() {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setSeconds(0, 0);
  at.setMinutes(at.getMinutes() <= 30 ? 30 : 60);
  return at;
}

/** A link to a calendar file for tomorrow's session. Nothing is saved anywhere; it's a reminder in their own calendar. */
export function AddToCalendar({ scenarioId, focus, className }: { scenarioId: string; focus?: Dimension | null; className?: string }) {
  // From this browser's clock, once. It only renders after data loads in the browser, never on the server.
  const [at] = useState(tomorrow);
  const start = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}T${pad(at.getHours())}${pad(at.getMinutes())}`;
  const query = new URLSearchParams({ scenario: scenarioId, start, ...(focus ? { focus } : {}) });
  return (
    <a className={cx("link inline-flex min-h-11 items-center gap-2", className)} href={`/api/calendar?${query}`}>
      <CalendarPlus aria-hidden="true" className="size-4" />
      Add tomorrow, {at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}, to your calendar
    </a>
  );
}
