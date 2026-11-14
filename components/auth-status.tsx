"use client";

import { useEffect, useState } from "react";
import { ensureClientAuth, errorMessage } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { cx } from "@/lib/cx";

export function AuthStatus({ configured }: { configured: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    ensureClientAuth().then(
      () => { if (active) setConnecting(false); },
      (error: unknown) => {
        if (!active) return;
        setConnecting(false);
        setMessage(errorMessage(error));
      },
    );
    return () => { active = false; };
  }, [configured, attempt]);

  if (!configured) return <Notice tone="warning">Practice is not available yet. Please check back soon.</Notice>;
  if (message) return (
    <Notice tone="warning" role="alert">
      <p>{message}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => { setMessage(null); setConnecting(true); setAttempt((value) => value + 1); }}>Try connecting again</Button>
    </Notice>
  );
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-neutral-500">
      <span aria-hidden="true" className={cx("size-2 rounded-full transition-colors", connecting ? "bg-neutral-300" : "bg-success")} />
      {connecting ? "Preparing your practice space…" : "Your practice space is ready."}
    </p>
  );
}
