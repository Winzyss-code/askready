import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("skeleton", className)} />;
}

type Tone = "info" | "success" | "warning" | "error";
const tones: Record<Tone, { icon: LucideIcon; box: string; mark: string }> = {
  info: { icon: Info, box: "bg-neutral-100", mark: "text-neutral-600" },
  success: { icon: CircleCheck, box: "bg-success-soft", mark: "text-success" },
  warning: { icon: TriangleAlert, box: "bg-warning-soft", mark: "text-warning" },
  error: { icon: CircleAlert, box: "bg-error-soft", mark: "text-error" },
};

/** Inline message with an icon, an optional title and room for one next action. */
export function Notice({ tone = "info", icon, title, role = "status", className, children }: {
  tone?: Tone; icon?: LucideIcon; title?: string; role?: "status" | "alert"; className?: string; children: React.ReactNode;
}) {
  const Icon = icon ?? tones[tone].icon;
  return (
    <div role={role} className={cx("flex gap-3 rounded-md p-4 text-sm animate-settle", tones[tone].box, className)}>
      <Icon aria-hidden="true" className={cx("mt-0.5 size-5 shrink-0", tones[tone].mark)} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cx(title && "mt-1", "text-neutral-600")}>{children}</div>
      </div>
    </div>
  );
}
