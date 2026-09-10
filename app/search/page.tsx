"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { SearchIndexEntry } from "@/lib/match";
import Badge from "@/components/Badge";

const TYPE_COLOR: Record<string, "teal" | "brass" | "rust" | "gray"> = {
  scenario: "teal",
  playbook: "brass",
  template: "gray",
  faq: "rust",
};

const TYPE_LABEL: Record<string, string> = {
  scenario: "Scenario",
  playbook: "Playbook",
  template: "Template",
  faq: "Knowledge Base",
};

export default function SearchPage() {
  const [index, setIndex] = useState<SearchIndexEntry[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/search-index").then((r) => r.json()).then(setIndex);
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(index, {
        keys: [
          { name: "title", weight: 0.5 },
          { name: "snippet", weight: 0.3 },
          { name: "subtitle", weight: 0.2 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
      }),
    [index]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query, { limit: 30 }).map((r) => r.item);
  }, [fuse, query]);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Search</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Search the Approval Knowledge Base</h1>
      <p className="mt-2 text-sm text-ink/65">
        Searches scenarios, playbooks, templates, and reference articles at once.
      </p>

      <input
        autoFocus
        className="mt-5 w-full rounded-xl border border-teal-100 bg-white px-4 py-3 text-base shadow-sm focus:border-teal-600 focus:outline-none"
        placeholder='Try "reinspection denied", "State Farm garage", "discontinued shingles"…'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-6 space-y-2">
        {results.map((r) => (
          <Link
            key={`${r.type}-${r.slug}`}
            href={r.url}
            className="focus-ring block rounded-lg border border-teal-100 bg-white p-4 hover:border-teal-600"
          >
            <div className="mb-1 flex items-center gap-2">
              <Badge color={TYPE_COLOR[r.type]}>{TYPE_LABEL[r.type]}</Badge>
              <span className="text-xs text-ink/40">{r.subtitle}</span>
            </div>
            <div className="font-semibold text-ink">{r.title}</div>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink/60">{r.snippet}</p>
          </Link>
        ))}
        {query.trim() && results.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/50">No results for &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
