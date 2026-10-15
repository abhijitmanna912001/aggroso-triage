import type { ReactNode } from "react";
import { toneClasses, type Tone } from "@/lib/ui/classes";

// The label is always rendered; the icon is a decorative extra.
export function Badge({
  tone,
  icon,
  className,
  children,
}: {
  tone: Tone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses(tone)} ${className ?? ""}`.trim()}
    >
      {icon}
      {children}
    </span>
  );
}
