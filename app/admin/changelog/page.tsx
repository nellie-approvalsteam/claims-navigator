"use client";

import { useEffect, useState } from "react";
import type { ChangelogEntry } from "@/lib/types";

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/changelog").then((r) => r.json()).then(setEntries);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Changelog</h1>
      <p className="mt-1 text-sm text-ink/60">
        Every create, edit, and delete made through this admin area, most recent first.
      </p>

      <div className="mt-6">
        {entries === null ? (
          <p className="text-sm text-ink/40">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-ink/40">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-teal-100 rounded-xl border border-teal-100 bg-white">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold capitalize">{e.action}</span>{" "}
                  <span className="text-ink/70">{e.itemLabel}</span>{" "}
                  <span className="text-ink/40">({e.type})</span>
                </span>
                <span className="text-xs text-ink/40">{new Date(e.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
