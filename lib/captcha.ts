"use client";

// Cloudflare Turnstile, only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (and the same provider is enabled under
// Supabase Auth → Bot and Abuse Protection, which checks the token). It runs only for a brand-new anonymous
// account or a sign-in link, and usually finishes without asking the visitor to do anything.
type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
export const captchaEnabled = Boolean(siteKey);
let script: Promise<Turnstile> | null = null;

function load() {
  script ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) { resolve(window.turnstile); return; }
    const tag = document.createElement("script");
    tag.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    tag.async = true;
    tag.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable"));
    tag.onerror = () => { script = null; reject(new Error("Turnstile unavailable")); };
    document.head.append(tag);
  });
  return script;
}

/** A one-time token. Shows Cloudflare's check in the corner only if it needs the visitor to click. */
export async function captchaToken(): Promise<string> {
  if (!siteKey) throw new Error("CAPTCHA is not configured");
  const turnstile = await load();
  const box = document.createElement("div");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Checking you’re a person");
  box.className = "fixed bottom-4 right-4 z-50";
  document.body.append(box);
  let id = "";
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("CAPTCHA timed out")), 60_000);
      id = turnstile.render(box, {
        sitekey: siteKey, appearance: "interaction-only", action: "start",
        callback: (token: string) => { clearTimeout(timer); resolve(token); },
        "error-callback": () => { clearTimeout(timer); reject(new Error("CAPTCHA failed")); },
        "expired-callback": () => { clearTimeout(timer); reject(new Error("CAPTCHA expired")); },
      });
    });
  } finally {
    if (id) turnstile.remove(id);
    box.remove();
  }
}
