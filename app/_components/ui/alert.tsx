import type { ReactNode } from "react";
import { toneClasses, type Tone } from "@/lib/ui/classes";
import { AlertTriangle, Check, Info, X } from "./icons";

const ICONS: Record<Tone, typeof Info> = {
  neutral: Info,
  info: Info,
  success: Check,
  warning: AlertTriangle,
  danger: X,
};

// The icon and the text carry the meaning, so color is never the only signal.
export function Alert({
  tone,
  title,
  id,
  children,
}: {
  tone: Tone;
  title?: string;
  id?: string;
  children?: ReactNode;
}) {
  const ToneIcon = ICONS[tone];
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return (
    <div id={id} role={role} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${toneClasses(tone)}`}>
      <ToneIcon className="mt-0.5" />
      <div className="min-w-0 grow">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
