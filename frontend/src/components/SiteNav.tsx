"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Product spec §10: Home, Birth Chart, Journal, Profile. Vedic, Western and
 * Compare are experiences inside the chart, not entries here. */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/chart", label: "Birth Chart" },
  { href: "/journal", label: "Journal" },
  { href: "/profile", label: "Profile" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-md bg-slate-800 px-3 py-1.5 text-amber-300"
                : "rounded-md px-3 py-1.5 text-slate-400 transition hover:text-slate-100"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
