import { cx } from "@/lib/cx";

type Tone = "neutral" | "outline" | "marker" | "ink" | "success" | "warning" | "error";

export function Badge({ tone = "neutral", size = "md", className, ...props }: React.ComponentProps<"span"> & { tone?: Tone; size?: "md" | "lg" }) {
  return <span className={cx("badge", `badge-${tone}`, size === "lg" && "badge-lg", className)} {...props} />;
}

/** Score change between two attempts. Gains carry the marker; drops are stated as plainly as gains. */
export function DeltaBadge({ value, size, className }: { value: number; size?: "md" | "lg"; className?: string }) {
  const label = value > 0 ? `+${value}` : value === 0 ? "No change" : `−${Math.abs(value)}`;
  return <Badge tone={value > 0 ? "marker" : value < 0 ? "warning" : "outline"} size={size} className={cx("tabular", className)}>{label}</Badge>;
}
