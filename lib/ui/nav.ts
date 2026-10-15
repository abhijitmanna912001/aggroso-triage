// Pure module: no imports, no I/O. Decides which main navigation link is active for a pathname.

export type NavHref = "/" | "/equipment" | "/reports/new";

// One trailing slash never changes the result. The root path stays "/".
function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

const REPORT_DETAIL = /^\/reports\/\d+$/;
const EQUIPMENT_DETAIL = /^\/equipment\/\d+$/;

// "/" covers the dashboard and report pages ("/reports/5"), but never "/reports/new".
export function isNavActive(pathname: string, href: NavHref): boolean {
  const path = normalize(pathname);
  switch (href) {
    case "/":
      return path === "/" || REPORT_DETAIL.test(path);
    case "/equipment":
      return path === "/equipment" || EQUIPMENT_DETAIL.test(path);
    case "/reports/new":
      return path === "/reports/new";
  }
}
