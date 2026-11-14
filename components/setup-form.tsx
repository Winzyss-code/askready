"use client";

import { useState } from "react";
import { ArrowRight, Check, Handshake, SearchCheck, Shield, UserRound, type LucideIcon } from "lucide-react";
import { personas } from "@/config/personas";
import type { Scenario } from "@/config/scenarios";
import { cx } from "@/lib/cx";
import { setupSchema } from "@/lib/validation";
import type { Setup } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

// Form control name → the path the schema reports for it.
const paths: Record<string, string> = { role: "role", desiredRaise: "desiredRaise", achievement0: "achievements.0", achievement1: "achievements.1", objection: "objection" };
const questions = Object.values(paths);
const nudges: Record<string, string> = {
  role: "Add your role. Two characters is enough.",
  desiredRaise: "Say what you’re asking for in a few words.",
  "achievements.0": "Add a little more detail so there’s something real to respond to.",
  "achievements.1": "Add a little more detail so there’s something real to respond to.",
  objection: "Add the pushback you expect, even a short one.",
};
const personaIcons: Record<string, LucideIcon> = { budget: Shield, friendly: Handshake, analyst: SearchCheck };

function read(form: HTMLFormElement) {
  const data = new FormData(form);
  const parsed = setupSchema.safeParse({
    role: data.get("role"), desiredRaise: data.get("desiredRaise"),
    achievements: [data.get("achievement0"), data.get("achievement1")],
    objection: data.get("objection"),
  });
  const failing = new Map<string, string>();
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const path = issue.path.join(".");
    if (!failing.has(path)) failing.set(path, nudges[path] ?? issue.message);
  }
  return { parsed, failing };
}

export function SetupForm({ scenario, disabled = false, onStart }: {
  scenario: Scenario;
  disabled?: boolean;
  onStart: (setup: Setup, personaId: string) => Promise<void>;
}) {
  const [personaId, setPersonaId] = useState<string>(personas[0].id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<string[]>([]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { parsed, failing } = read(event.currentTarget);
    if (!parsed.success) {
      setErrors(Object.fromEntries(failing));
      return;
    }
    setErrors({});
    await onStart(parsed.data, personaId);
  }

  // Progress follows every edit; an error clears as soon as its field passes.
  function track(event: React.FormEvent<HTMLFormElement>) {
    const { failing } = read(event.currentTarget);
    setAnswered(questions.filter((path) => !failing.has(path)));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([path]) => failing.has(path))));
  }

  // Only speak up about a field once someone has typed in it and moved on.
  function review(event: React.FocusEvent<HTMLFormElement>) {
    const control = event.target as unknown as HTMLInputElement | HTMLTextAreaElement;
    const path = paths[control.name];
    if (!path) return;
    const message = control.value.trim() ? read(event.currentTarget).failing.get(path) : undefined;
    setErrors((current) => {
      if (current[path] === message) return current;
      const next = { ...current };
      if (message) next[path] = message; else delete next[path];
      return next;
    });
  }

  const wiring = (path: string) => ({ "aria-invalid": Boolean(errors[path]), "aria-describedby": errors[path] ? `${path}-error` : undefined });
  const field = (path: string) => ({ error: errors[path], errorId: `${path}-error`, valid: answered.includes(path) });
  const legend = "display flex items-baseline gap-3 text-xl";
  const numeral = "figure text-neutral-400";
  const { request, facts, objection } = scenario.fields;

  return (
    <form onSubmit={submit} onChange={track} onBlur={review} className="space-y-10">
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="flex flex-1 gap-1">
          {questions.map((path, index) => <span key={path} className={cx("h-1.5 flex-1 rounded-full transition-colors", index < answered.length ? "bg-ink" : "bg-neutral-300")} />)}
        </span>
        <p className="tabular shrink-0 text-sm text-neutral-600">{answered.length} of {questions.length} answered</p>
      </div>

      <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
        <legend className={legend}><span aria-hidden="true" className={numeral}>1</span>What’s the ask?</legend>
        <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Field label="Your job role" htmlFor="role" {...field("role")}>
            <Input id="role" name="role" required minLength={2} maxLength={120} placeholder="Product designer" autoComplete="organization-title" {...wiring("role")} />
          </Field>
          <Field label={request.label} htmlFor="desiredRaise" {...field("desiredRaise")}>
            <Input id="desiredRaise" name="desiredRaise" required minLength={2} maxLength={200} placeholder={request.placeholder} {...wiring("desiredRaise")} />
          </Field>
        </div>
      </fieldset>

      <fieldset disabled={disabled} className="min-w-0 border-t border-neutral-200 pt-8 disabled:opacity-60">
        <legend className={cx(legend, "float-left w-full")}><span aria-hidden="true" className={numeral}>2</span>{facts.legend}</legend>
        <p className="clear-both max-w-measure pt-3 text-sm text-neutral-500">{facts.hint} Use only facts you can support, and leave out confidential company or client details.</p>
        <div className="mt-6 space-y-6">
          {[0, 1].map((index) => (
            <Field key={index} label={facts.labels[index]} htmlFor={`achievement${index}`} {...field(`achievements.${index}`)}>
              <Textarea className="min-h-24" id={`achievement${index}`} name={`achievement${index}`} required minLength={5} maxLength={600} rows={3} placeholder={facts.placeholders[index]} {...wiring(`achievements.${index}`)} />
            </Field>
          ))}
        </div>
      </fieldset>

      <div className="space-y-8 border-t border-neutral-200 pt-8">
        <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
          <legend className={legend}><span aria-hidden="true" className={numeral}>3</span>Who’s across the table?</legend>
          <Field className="mt-6" label={objection.label} htmlFor="objection" hint={objection.hint} {...field("objection")}>
            <Textarea className="min-h-20" id="objection" name="objection" required minLength={3} maxLength={400} rows={2} placeholder={objection.placeholder} {...wiring("objection")} />
          </Field>
        </fieldset>

        <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
          <legend className="text-sm font-semibold">Choose who you’re up against</legend>
          <div className="mt-3 grid gap-3">
            {personas.map((persona) => {
              const Icon = personaIcons[persona.id] ?? UserRound;
              const chosen = personaId === persona.id;
              return (
                <label key={persona.id} className={cx(
                  "card flex cursor-pointer items-start gap-4 p-4 transition-[border-color,box-shadow,background-color]",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                  chosen ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "hover:border-neutral-400 hover:bg-neutral-100",
                )}>
                  <input type="radio" name="persona" value={persona.id} checked={chosen} onChange={() => setPersonaId(persona.id)} className="sr-only" />
                  <span aria-hidden="true" className={cx("flex size-12 shrink-0 items-center justify-center rounded-full transition-colors", chosen ? "bg-ink text-marker" : "bg-neutral-100 text-neutral-600")}><Icon className="size-6" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-semibold">{persona.name}</span><Badge tone={chosen ? "ink" : "neutral"}>{persona.title}</Badge></span>
                    <span className="mt-1 block text-sm text-neutral-600">{persona.description}</span>
                  </span>
                  <span aria-hidden="true" className={cx("mt-1 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors", chosen ? "bg-marker text-ink" : "border border-neutral-300 text-transparent")}><Check className="size-4" strokeWidth={3} /></span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-neutral-200 pt-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" disabled={disabled}>{disabled ? "Preparing your conversation…" : <>Start my rehearsal<ArrowRight aria-hidden="true" className="size-4" /></>}</Button>
          <p className="text-sm text-neutral-600">About 2–3 minutes. Voice or text. One free session per day.</p>
        </div>
        <p className="mt-6 max-w-measure text-sm text-neutral-500">Your setup and conversation are processed by AI to generate the roleplay and coaching. This is practice, not a prediction of how the real conversation will go.</p>
      </div>
    </form>
  );
}
