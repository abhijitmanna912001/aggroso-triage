"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, type NavHref } from "@/lib/ui/nav";

const LINKS: { href: NavHref; label: string }[] = [
  { href: "/", label: "Reports" },
  { href: "/equipment", label: "Equipment" },
  { href: "/reports/new", label: "New report" },
];

const LINK_BASE =
  "inline-flex min-h-11 items-center border-b-2 px-1 text-sm underline-offset-4 hover:text-accent";

// `active` is the href of the current link, or null when no link matches.
export function NavLinks({ active }: { active: NavHref | null }) {
  return (
    <nav aria-label="Main" className="flex gap-4">
      {LINKS.map(({ href, label }) => {
        const isActive = href === active;
        return (
          <Link
            key={href}
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
  const pathname = usePathname();
  const active = LINKS.find((link) => isNavActive(pathname, link.href))?.href ?? null;
  return <NavLinks active={active} />;
}
