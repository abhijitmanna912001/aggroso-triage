import type { HTMLAttributes } from "react";
import { cardClasses } from "@/lib/ui/classes";

// Forwards the standard attributes (id, aria-labelledby, aria-label, ...) to the element.
export function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: Readonly<
  {
    as?: "div" | "section" | "article";
  } & HTMLAttributes<HTMLElement>
>) {
  return (
    <Tag className={`${cardClasses} ${className ?? ""}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
