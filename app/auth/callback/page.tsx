"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { ButtonLink } from "@/components/ui/button";

type Account = { email: string | null };

/**
 * Where the email links land. Supabase puts the session in the #fragment (or a token hash in the query); this
 * page hands it to the server, which keeps it in HTTP-only cookies, and wipes it from the address bar.
 */
export default function AuthCallbackPage() {
  const [state, setState] = useState<{ status: "working" } | { status: "done"; email: string | null } | { status: "error"; message: string }>({ status: "working" });

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    window.history.replaceState(null, "", "/auth/callback");
    const problem = hash.get("error_description") || query.get("error_description");
    const body = hash.get("access_token") && hash.get("refresh_token")
      ? { accessToken: hash.get("access_token"), refreshToken: hash.get("refresh_token"), ...(Number(hash.get("expires_in")) > 0 ? { expiresIn: Number(hash.get("expires_in")) } : {}) }
      : query.get("token_hash") && query.get("type") ? { tokenHash: query.get("token_hash"), type: query.get("type") } : null;
    (async () => {
      if (problem || !body) {
        setState({ status: "error", message: problem ? `${problem.replace(/\+/g, " ")}.` : "This link is missing its sign-in details. Ask for a new one." });
        return;
      }
      try {
        const { account } = await api<{ account: Account }>("/api/account/session", body);
        setState({ status: "done", email: account.email });
      } catch (error) { setState({ status: "error", message: errorMessage(error) }); }
    })();
  }, []);

  return (
    <main id="main" className="shell pb-16 pt-8 lg:pt-16">
      <div className="max-w-measure">
        {state.status === "working" ? <>
          <h1 className="display text-2xl">Signing you in…</h1>
          <p role="status" className="mt-4 text-neutral-600">One moment.</p>
        </> : state.status === "done" ? <>
          <h1 className="display text-2xl">Your progress is saved.</h1>
          <p className="mt-4 text-lg text-neutral-600">{state.email ? <>This browser is signed in as <strong className="font-semibold text-ink">{state.email}</strong>. </> : null}Sign in with the same email on any other device to keep going there.</p>
          <ButtonLink className="mt-8" href="/progress">See your progress</ButtonLink>
        </> : <>
          <CircleAlert aria-hidden="true" className="size-8 text-error" />
          <h1 className="display mt-4 text-2xl">That link didn’t work.</h1>
          <p role="alert" className="mt-4 text-neutral-600">{state.message}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href="/progress#account">Ask for a new link</ButtonLink>
            <Link className="link flex min-h-11 items-center" href="/">Return home</Link>
          </div>
        </>}
      </div>
    </main>
  );
}
