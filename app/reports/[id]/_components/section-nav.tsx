import { WORKSPACE_SECTIONS } from "@/lib/ui/workspace-view";

// One list, two layouts: a horizontally scrollable pill bar below lg and a vertical list in the side rail from lg.
export function SectionNav() {
  return (
    <nav aria-label="Report sections" className="min-w-0">
      <ul className="flex snap-x gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {WORKSPACE_SECTIONS.map((section) => (
          <li key={section.id} className="shrink-0 snap-start">
            <a
              href={`#${section.id}`}
              className="block rounded-full border border-line bg-surface-raised px-3 py-1.5 text-sm font-medium whitespace-nowrap hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:rounded-md lg:border-transparent lg:bg-transparent lg:py-1"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
