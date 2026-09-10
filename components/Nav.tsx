"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/navigator", label: "Claim Navigator" },
  { href: "/stuck", label: "I'm Stuck" },
  { href: "/next-step", label: "Next Step" },
  { href: "/playbooks", label: "Playbooks" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/templates", label: "Templates" },
  { href: "/knowledge-base", label: "Knowledge Base" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname?.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-teal-100 bg-paper-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-teal-800">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-700 text-sm text-white">
            CN
          </span>
          <span className="hidden sm:inline">Claims Navigator</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === l.href
                  ? "bg-teal-700 text-white"
                  : "text-ink/70 hover:bg-teal-100 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="focus-ring hidden rounded-md border border-teal-100 bg-white px-3 py-2 text-sm text-ink/70 hover:border-teal-600 hover:text-ink sm:flex sm:items-center sm:gap-2"
          >
            <SearchIcon />
            <span>Search</span>
          </Link>
          <button
            className="focus-ring rounded-md border border-teal-100 bg-white p-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-teal-100 bg-white px-4 py-2 lg:hidden">
          <Link
            href="/search"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm font-medium text-ink/70 hover:bg-teal-100"
          >
            Search
          </Link>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                pathname === l.href ? "bg-teal-700 text-white" : "text-ink/70 hover:bg-teal-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
