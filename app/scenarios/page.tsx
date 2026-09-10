"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/types";
import Badge from "@/components/Badge";

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content/scenarios").then((r) => r.json()).then(setScenarios);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(scenarios.map((s) => s.category))).sort(),
    [scenarios]
  );

  const filtered = useMemo(() => {
    return scenarios.filter((s) => {
      if (category && s.category !== category) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.whatHappened.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [scenarios, query, category]);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Scenario Library</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Common Approval Scenarios</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          {scenarios.length} scenarios and counting — each with what happened, what to check,
          possible solutions, and a recommended first move.
        </p>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="field sm:max-w-xs"
          placeholder="Search scenarios…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              category === null ? "bg-teal-700 text-white" : "bg-teal-100 text-teal-800"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                category === c ? "bg-teal-700 text-white" : "bg-teal-100 text-teal-800"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((s) => (
          <Link
            key={s.slug}
            href={`/scenarios/${s.slug}`}
            className="focus-ring flex flex-col gap-2 rounded-xl border border-teal-100 bg-white p-4 hover:border-teal-600"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-ink">{s.name}</h3>
              <Badge>{s.category}</Badge>
            </div>
            <p className="line-clamp-2 text-sm text-ink/60">{s.whatHappened}</p>
          </Link>
        ))}
        {filtered.length === 0 && scenarios.length > 0 && (
          <p className="col-span-2 py-8 text-center text-sm text-ink/50">
            No scenarios match that search.
          </p>
        )}
      </div>

      <style jsx global>{`
        .field {
          border-radius: 0.5rem;
          border: 1px solid #d6e3de;
          background: white;
          padding: 0.55rem 0.8rem;
          font-size: 0.875rem;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
