import type { ReactNode } from "react";
import { cardClasses } from "@/lib/ui/classes";

export function Card({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "section" | "article";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`${cardClasses} ${className ?? ""}`.trim()}>{children}</Tag>;
}
