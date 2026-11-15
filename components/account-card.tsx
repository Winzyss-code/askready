"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { api, ensureClientAuth, errorMessage } from "@/lib/client";
import { captchaEnabled } from "@/lib/captcha";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";

type Account = { email: string | null; pendingEmail: string | null; anonymous: boolean };

/**
 * "Save your progress": an anonymous account adds an email so its practice survives cleared cookies and a new
 * phone, or a saved account signs in here. Optional; practice never waits on it.
 */
export function AccountCard({ className }: { className?: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<"save" | "sign-in">("save");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        await ensureClientAuth();
        const result = await api<{ account: Account }>("/api/account", undefined, { signal: controller.signal });
        setAccount(result.account);
      } catch { if (!controller.signal.aborted) setFailed(true); }
    })();
    return () => controller.abort();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setBusy(true); setError(null);
    try {
      if (mode === "save") await api("/api/account/link", { email });
      else {
        const captcha = captchaEnabled ? await (await import("@/lib/captcha")).captchaToken() : undefined;
        await api("/api/account/sign-in", { email, ...(captcha ? { captchaToken: captcha } : {}) });
      }
      setSent(email);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError(null);
    try { await api("/api/account/sign-out", {}); router.push("/"); router.refresh(); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }

  if (failed) return null;
  if (!account) return <Skeleton className={cx("h-40 rounded-lg", className)} />;

  if (!account.anonymous && account.email) return (
    <Card as="section" id="account" className={cx("p-6 sm:p-8", className)} aria-labelledby="account-heading">
      <h2 id="account-heading" className="font-semibold">Your progress is saved</h2>
      <p className="mt-2 max-w-measure text-neutral-600">It’s kept under <strong className="font-semibold text-ink">{account.email}</strong>. On another phone or browser, sign in with that email to pick up where you left off.</p>
      {error && <Notice tone="error" role="alert" className="mt-4">{error}</Notice>}
      <Button variant="secondary" size="sm" className="mt-4" disabled={busy} onClick={() => void signOut()}>Sign out of this browser</Button>
    </Card>
  );

  const pending = !sent && account.pendingEmail;
  return (
    <Card as="section" id="account" className={cx("p-6 sm:p-8", className)} aria-labelledby="account-heading">
      <h2 id="account-heading" className="font-semibold">{mode === "save" ? "Save your progress" : "Sign in to saved progress"}</h2>
      {sent || pending ? <div className="mt-3 flex gap-3" role="status">
        <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p className="max-w-measure text-neutral-600">{mode === "save" || pending
          ? <>We sent a link to <strong className="font-semibold text-ink">{sent || account.pendingEmail}</strong>. Open it in this browser to finish saving. Until then, your practice is still here.</>
          : <>If <strong className="font-semibold text-ink">{sent}</strong> has saved progress, a sign-in link is on its way. Open it on this device.</>}
          {" "}<button type="button" className="link" onClick={() => { setSent(null); setAccount({ ...account, pendingEmail: null }); }}>Use a different email</button></p>
      </div> : <>
        <p className="mt-2 max-w-measure text-neutral-600">{mode === "save"
          ? "Right now your sessions live only in this browser. Add your email and we’ll send a link; open it and your days in a row and skill levels follow you to any device."
          : "Enter the email you saved your progress under, and we’ll send a link that signs this browser in. Anything practiced here without saving stays with this browser."}</p>
        <form onSubmit={submit} className="mt-4 flex max-w-lg flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor="account-email" className="mb-2 block text-sm font-semibold">Email</label>
            <Input id="account-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : mode === "save" ? "Email me a link" : "Send sign-in link"}</Button>
        </form>
      </>}
      {error && <Notice tone="error" role="alert" className="mt-4">{error}</Notice>}
      {!sent && !pending && <p className="mt-4 text-sm text-neutral-500">
        {mode === "save" ? "Already saved on another device? " : "Haven’t saved yet? "}
        <button type="button" className="link" onClick={() => { setMode(mode === "save" ? "sign-in" : "save"); setError(null); }}>{mode === "save" ? "Sign in instead" : "Save this browser’s progress"}</button>
        {" "}We only use your email for sign-in links.
      </p>}
    </Card>
  );
}
