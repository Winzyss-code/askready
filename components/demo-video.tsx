"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * A real session, recorded by scripts/record-demo.mjs against the running app and cut by scripts/cut-demo.mjs:
 * the waits are shortened and some moments sped up, nothing is added. Silent, looping, inline. With reduced
 * motion it stays on its first frame and offers controls instead of playing by itself.
 */
export function DemoVideo({ className }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setStill(query.matches);
      if (query.matches) video.current?.pause();
      else void video.current?.play().catch(() => undefined);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return (
    <figure className={cx("min-w-0", className)}>
      <div className="card mx-auto max-w-xs overflow-hidden rounded-lg shadow-lg">
        <video ref={video} className="block aspect-[400/760] w-full bg-paper" src="/demo.mp4" poster="/demo-poster.jpg" muted loop playsInline preload="metadata" controls={still}
          aria-label="A real practice session: an example raise case, the manager pushing back, coaching, the retry and the before-and-after comparison." />
      </div>
      <figcaption className="mx-auto mt-4 max-w-xs text-sm text-neutral-500">A real session with the example case, cut to 24 seconds and sped up in places. No sound; in the app the manager speaks.</figcaption>
    </figure>
  );
}
