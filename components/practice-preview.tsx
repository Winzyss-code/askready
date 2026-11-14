import { Square, Timer, Volume2 } from "lucide-react";
import { ManagerDisc } from "@/components/manager-disc";
import { cx } from "@/lib/cx";

// Bar heights (% of the meter) for the still waveform. Zero is a rest dot, as before any sound arrives.
const levels = [0, 0, 0, 0, 0, 0, 0, 0, 22, 48, 70, 38, 86, 60, 30, 54, 92, 66, 40, 24, 58, 78, 44, 28, 64, 50];

/** A still of the practice screen mid-recording, built from the same parts. Illustration only: nothing here is interactive. */
export function PracticePreview({ className }: { className?: string }) {
  return (
    <figure className={cx("min-w-0", className)}>
      <div aria-hidden="true" className="card select-none overflow-hidden rounded-lg shadow-lg">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-3 opacity-50 sm:px-6">
          <p className="display text-base">Ask for a raise</p>
          <div className="flex items-center gap-4 text-sm text-neutral-600">
            <span className="flex items-center gap-2">
              <span className="flex gap-1">{[0, 1, 2, 3, 4, 5].map((pip) => <span key={pip} className={cx("h-1.5 w-2 rounded-full sm:w-3", pip < 2 ? "bg-ink" : "bg-neutral-300")} />)}</span>
              <span className="tabular">2 of 6</span>
            </span>
            <span className="tabular flex items-center gap-1"><Timer className="size-4" />1:42</span>
          </div>
        </div>
        <div className="px-5 pb-6 pt-6 sm:px-6">
          <div className="flex items-center gap-4">
            <ManagerDisc state="listening" size="md" />
            <div>
              <p className="font-semibold">The hard-liner</p>
              <p className="text-sm text-neutral-500">Listening</p>
            </div>
          </div>
          <p className="mt-6 text-lg font-medium">I appreciate your work. But budgets are frozen.</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500"><Volume2 className="size-4" />AI-generated voice</p>
        </div>
        <div className="flex items-center gap-4 border-t border-neutral-200 bg-paper px-5 py-4 sm:px-6">
          <span className="flex shrink-0 flex-col items-center gap-1 text-sm font-semibold">
            <span className="rec" data-state="recording">
              <svg className="rec-ring" viewBox="0 0 96 96"><circle className="rec-track" cx="48" cy="48" r="45.5" /><circle className="rec-clock" cx="48" cy="48" r="45.5" pathLength={100} strokeDasharray={100} strokeDashoffset={87} /></svg>
              <Square className="size-6" fill="currentColor" />
            </span>
            Stop recording
          </span>
          <span className="flex h-10 min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden">
            {levels.map((level, index) => <span key={index} className={cx("w-1 shrink-0 rounded-full", level ? "bg-ink" : "h-0.5 bg-neutral-300")} style={level ? { height: `${level}%` } : undefined} />)}
          </span>
          <p className="figure shrink-0 text-lg">0:12<span className="ml-1 font-sans text-sm font-normal tracking-normal text-neutral-500">/ 1:30</span></p>
        </div>
      </div>
      <figcaption className="mt-4 text-sm text-neutral-500">An example of the moments you can rehearse. Your practice conversation responds to your actual case.</figcaption>
    </figure>
  );
}
