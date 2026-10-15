// Pure module: no imports, no I/O. Class strings for the shared UI primitives, written for Tailwind CSS v4.
// Colors come from the semantic tokens in app/globals.css, so dark mode needs no extra classes here.

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent/90 disabled:hover:bg-accent",
  secondary:
    "border border-line bg-surface-raised text-foreground hover:bg-line/40 disabled:hover:bg-surface-raised",
  danger: "border border-danger/50 bg-danger-soft text-danger hover:bg-danger/10 disabled:hover:bg-danger-soft",
  ghost: "text-foreground hover:bg-line/40 disabled:hover:bg-transparent",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
};

export function buttonClasses({
  variant,
  size,
  fullWidth = false,
}: {
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth?: boolean;
}): string {
  return [BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], fullWidth ? "w-full" : ""]
    .filter(Boolean)
    .join(" ");
}

// Shared by input, select and textarea. The border uses muted/60 (about 3:1 on white) so the control edge is visible.
export const controlClasses =
  "block w-full min-h-11 rounded-md border border-muted/60 bg-surface-raised px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger";

export const cardClasses = "rounded-lg border border-line bg-surface-raised p-4 shadow-xs sm:p-6";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-raised text-foreground border-line",
  info: "bg-info-soft text-info border-info/40",
  success: "bg-success-soft text-success border-success/40",
  warning: "bg-warning-soft text-warning border-warning/40",
  danger: "bg-danger-soft text-danger border-danger/40",
};

// Surface, text and border classes for a tone.
export function toneClasses(tone: Tone): string {
  return TONES[tone];
}
