"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONTENT_LABELS } from "@/lib/adminSchema";
import type { ContentType, ChangelogEntry } from "@/lib/types";

const TYPES: ContentType[] = ["scenarios", "playbooks", "templates", "carriers", "faq"];

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    Promise.all(
      TYPES.map((t) => fetch(`/api/content/${t}`).then((r) => r.json()).then((d) => [t, d.length]))
    ).then((pairs) => setCounts(Object.fromEntries(pairs)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-ink/60">
        Add, edit, or remove content. Changes take effect immediately — no code changes or
        redeploys needed.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TYPES.map((t) => (
          <Link
            key={t}
            href={`/admin/${t}`}
            className="focus-ring rounded-xl border border-teal-100 bg-white p-4 hover:border-teal-600"
          >
            <div className="text-sm font-semibold text-ink">{CONTENT_LABELS[t].plural}</div>
            <div className="mt-1 text-2xl font-bold text-teal-700">{counts[t] ?? "…"}</div>
            <div className="mt-1 text-xs text-ink/50">Add / edit / delete</div>
          </Link>
        ))}
        <Link
          href="/admin/rules"
          className="focus-ring rounded-xl border border-teal-100 bg-white p-4 hover:border-teal-600"
        >
          <div className="text-sm font-semibold text-ink">Decision Rules</div>
          <div className="mt-1 text-2xl font-bold text-teal-700">⚙</div>
          <div className="mt-1 text-xs text-ink/50">Claim Navigator weights & next-step text</div>
        </Link>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink/70">Recent changes</h2>
          <Link href="/admin/changelog" className="text-xs font-semibold text-teal-700 hover:underline">
            View all →
          </Link>
        </div>
        <RecentChangelog />
      </div>
    </div>
  );
}

function RecentChangelog() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/changelog")
      .then((r) => r.json())
      .then((d) => setEntries(d.slice(0, 8)))
      .catch(() => setEntries([]));
  }, []);

  if (entries === null) return <p className="text-sm text-ink/40">Loading…</p>;
  if (entries.length === 0) return <p className="text-sm text-ink/40">No changes yet.</p>;

  return (
    <ul className="divide-y divide-teal-100 rounded-xl border border-teal-100 bg-white">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span>
            <span className="font-semibold capitalize">{e.action}</span>{" "}
            <span className="text-ink/70">{e.itemLabel}</span>{" "}
            <span className="text-ink/40">({e.type})</span>
          </span>
          <span className="text-xs text-ink/40">{new Date(e.timestamp).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
