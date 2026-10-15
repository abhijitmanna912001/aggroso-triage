// Small inline SVG icons: 16px, decorative (aria-hidden), colored by the surrounding text color.
import type { ReactNode } from "react";

export type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className ?? ""}`.trim()}
    >
      {children}
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </Icon>
  );
}

export function X(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Icon>
  );
}

export function AlertTriangle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2 1.5 13.5h13L8 2Z" />
      <path d="M8 6.5v3" />
      <path d="M8 11.8v.01" />
    </Icon>
  );
}

export function Clock(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </Icon>
  );
}

export function Pencil(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m10.5 2.5 3 3L5 14H2v-3l8.5-8.5Z" />
    </Icon>
  );
}

export function Question(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.2 6.3a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.3" />
      <path d="M8 11.5v.01" />
    </Icon>
  );
}

export function Dot(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="3" fill="currentColor" />
    </Icon>
  );
}

export function Info(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.5v4" />
      <path d="M8 4.8v.01" />
    </Icon>
  );
}
