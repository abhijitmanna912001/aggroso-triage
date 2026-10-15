import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/lib/ui/classes";

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean };

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  type = "button",
  className,
  ...rest
}: Readonly<StyleProps & ComponentProps<"button">>) {
  const classes = `${buttonClasses({ variant, size, fullWidth })} ${className ?? ""}`.trim();
  return <button type={type} className={classes} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  ...rest
}: Readonly<StyleProps & ComponentProps<typeof Link>>) {
  const classes = `${buttonClasses({ variant, size, fullWidth })} ${className ?? ""}`.trim();
  return <Link className={classes} {...rest} />;
}
