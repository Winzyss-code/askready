import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rubric } from "@/config/rubric";
import { getScenario } from "@/config/scenarios";
import { errorResponse, ApiError } from "@/lib/api";
export const runtime = "nodejs";

// A calendar file for tomorrow's session. Stateless: no account, no storage. The time is the visitor's local
// wall-clock time, written as a "floating" time so their calendar keeps it in their own time zone.
const querySchema = z.object({
  scenario: z.string().max(80),
  focus: z.enum(["clear_request", "evidence", "structure", "objection_handling", "next_step"]).optional(),
  start: z.string().regex(/^\d{8}T\d{4}$/),
});

const escape = (text: string) => text.replace(/[\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, "\\n");
// Lines longer than 75 bytes are folded onto continuation lines that start with a space.
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (parts.length ? 74 : 75)) { parts.push(current); current = ""; }
    current += char;
  }
  return [...parts, current].join("\r\n ");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = querySchema.safeParse(Object.fromEntries(url.searchParams));
    const scenario = input.success ? getScenario(input.data.scenario) : undefined;
    if (!input.success || !scenario?.live) throw new ApiError(400, "INVALID_INPUT", "That reminder link isn’t valid.");
    const focus = rubric.find((item) => item.id === input.data.focus);
    const link = `${url.origin}/practice/${scenario.id}`;
    const start = `${input.data.start}00`;
    const [, y, mo, d, h, mi] = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(start)!;
    const end = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi + 15));
    const floating = (date: Date) => date.toISOString().replace(/[-:]/g, "").slice(0, 15);
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AskReady//Daily practice//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${randomUUID()}@askready`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART:${start}`,
      `DTEND:${floating(end)}`,
      `SUMMARY:${escape(`AskReady: ${scenario.title}`)}`,
      `DESCRIPTION:${escape([scenario.lesson ? `Technique: ${scenario.lesson.technique}.` : "", focus ? `Your focus: ${focus.label.toLowerCase()}. ${focus.exercise}` : "", `About 3 minutes: ${link}`].filter(Boolean).join("\n"))}`,
      `URL:${link}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escape(`AskReady: ${scenario.title}`)}`, "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ];
    return new Response(`${lines.map(fold).join("\r\n")}\r\n`, {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "attachment; filename=\"askready-tomorrow.ics\"", "Cache-Control": "no-store" },
    });
  } catch (error) { return errorResponse(error); }
}
