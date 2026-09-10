"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Playbook } from "@/lib/types";

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);

  useEffect(() => {
    fetch("/api/content/playbooks").then((r) => r.json()).then(setPlaybooks);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Playbooks</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Standardized Workflows</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          When to use it → what to check → steps → templates → follow-up → escalation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {playbooks.map((p) => (
          <Link
            key={p.slug}
            href={`/playbooks/${p.slug}`}
            className="focus-ring flex flex-col gap-2 rounded-xl border border-teal-100 bg-white p-4 hover:border-teal-600"
          >
            <h3 className="font-semibold text-ink">{p.name}</h3>
            <p className="text-sm text-ink/60">{p.summary}</p>
            <span className="mt-1 text-xs font-semibold text-teal-700">{p.steps.length} steps →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
