import { cx } from "@/lib/cx";

type Tag = "div" | "section" | "article" | "aside" | "li";

export function Card({ as: Element = "div", className, ...props }: React.HTMLAttributes<HTMLElement> & { as?: Tag }) {
  return <Element className={cx("card", className)} {...props} />;
}
