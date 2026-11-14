import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cx("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cx("field", className)} {...props} />;
}

/** Label, control, then one line beneath it: the error when there is one, otherwise the hint. */
export function Field({ label, htmlFor, hint, error, errorId, valid = false, className, children }: {
  label: string; htmlFor: string; hint?: React.ReactNode; error?: string; errorId?: string; valid?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold">{label}</label>
        {valid && !error && <Check aria-hidden="true" className="size-4 text-success animate-settle" strokeWidth={2.5} />}
      </div>
      {children}
      {error ? <p id={errorId} role="alert" className="mt-2 text-sm text-error">{error}</p> : hint ? <p className="mt-2 text-sm text-neutral-500">{hint}</p> : null}
    </div>
  );
}
