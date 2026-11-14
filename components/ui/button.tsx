import Link from "next/link";
import { cx } from "@/lib/cx";

type Variant = "primary" | "accent" | "secondary" | "ghost";
type Size = "md" | "sm";
type Look = { variant?: Variant; size?: Size };

export function buttonClass({ variant = "primary", size = "md" }: Look = {}, className?: string) {
  return cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className);
}

export function Button({ variant, size, className, type = "button", ...props }: React.ComponentProps<"button"> & Look) {
  return <button type={type} className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: React.ComponentProps<typeof Link> & Look) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
