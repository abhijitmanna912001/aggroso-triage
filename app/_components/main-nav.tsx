"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Section = "reports" | "equipment" | "new";

const LINKS: { section: Section; href: string; label: string }[] = [
  { section: "reports", href: "/", label: "Reports" },
  { section: "equipment", href: "/equipment", label: "Equipment" },
  { section: "new", href: "/reports/new", label: "New report" },
];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

// Exactly one section is active. "/reports/new" is New report only; every other "/reports/..." (for example
// "/reports/5") and "/" belong to Reports.
function sectionOf(pathname: string): Section | null {
  if (under(pathname, "/reports/new")) return "new";
  if (pathname === "/" || under(pathname, "/reports")) return "reports";
  if (under(pathname, "/equipment")) return "equipment";
  return null;
}

const LINK_BASE =
  "inline-flex min-h-11 items-center border-b-2 px-1 text-sm underline-offset-4 hover:text-accent";

export function NavLinks({ active }: { active: Section | null }) {
  return (
    <nav aria-label="Main" className="flex gap-4">
      {LINKS.map(({ section, href, label }) => {
        const isActive = section === active;
        return (
          <Link
            key={section}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`${LINK_BASE} ${isActive ? "border-accent font-medium text-foreground" : "border-transparent text-muted"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MainNav() {
  return <NavLinks active={sectionOf(usePathname())} />;
}
