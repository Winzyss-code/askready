"use client";

import { useState, type FormEvent } from "react";
import { api, ensureClientAuth, errorMessage } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "joined">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;
    setState("saving");
    setError(null);
    try {
      await ensureClientAuth();
      const data = await api<{ joined: boolean }>("/api/waitlist", { email: email.trim() });
      if (data.joined !== true) throw new Error("We could not save your email. Please try again.");
      setState("joined");
    } catch (caught) {
      setError(errorMessage(caught));
      setState("idle");
    }
  }

  if (state === "joined") return <Notice tone="success" title="You’re on the Pro waitlist." className="mt-8">Your email is saved. No payment was taken, and your account stays on the Free plan.</Notice>;

  return (
    <form onSubmit={submit} className="mt-8 border-t border-neutral-200 pt-6">
      <label htmlFor="waitlist-email" className="block text-sm font-semibold">Email for Pro updates</label>
      <Input id="waitlist-email" className="mt-2" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={state === "saving"} aria-describedby="waitlist-note" />
      <p id="waitlist-note" className="mt-2 text-xs text-neutral-500">We’ll use this email for updates about AskReady Pro. No card required.</p>
      {error && <Notice tone="error" role="alert" className="mt-4">{error}</Notice>}
      <Button type="submit" variant="secondary" className="mt-4 w-full" disabled={state === "saving"}>{state === "saving" ? "Joining waitlist…" : "Join Pro waitlist"}</Button>
    </form>
  );
}
