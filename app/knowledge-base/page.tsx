"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FaqArticle, Carrier } from "@/lib/types";
import Badge from "@/components/Badge";

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<FaqArticle[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/content/faq").then((r) => r.json()).then(setArticles);
    fetch("/api/content/carriers").then((r) => r.json()).then(setCarriers);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const q = query.toLowerCase();
    return articles.filter(
      (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );
  }, [articles, query]);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Quick References</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Knowledge Base</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          Definitions, reference facts, and carrier notes — the things you look up, not the steps
          you follow.
        </p>
      </div>

      <input
        className="mb-5 w-full max-w-xs rounded-lg border border-teal-100 bg-white px-3 py-2 text-sm"
        placeholder="Search reference articles…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((a) => (
          <Link
            key={a.slug}
            href={`/knowledge-base/${a.slug}`}
            className="focus-ring flex flex-col gap-2 rounded-xl border border-teal-100 bg-white p-4 hover:border-teal-600"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-ink">{a.title}</h3>
              <Badge color="brass">{a.category}</Badge>
            </div>
            <p className="text-sm text-ink/60">{a.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Carriers</h2>
        <p className="mb-3 text-sm text-ink/60">
          Carrier-specific notes, added by admins as the team learns each carrier&apos;s patterns.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {carriers.map((c) => (
            <div key={c.id} className="rounded-lg border border-teal-100 bg-white p-3">
              <div className="font-medium text-ink">{c.name}</div>
              <div className="mt-1 text-xs text-ink/50">
                {c.notes ? c.notes : "No notes yet — add via the Admin area."}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
