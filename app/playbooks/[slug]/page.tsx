"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Playbook } from "@/lib/types";

export default function PlaybookDetailPage({ params }: { params: { slug: string } }) {
  const [playbook, setPlaybook] = useState<Playbook | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/content/playbooks")
      .then((r) => r.json())
      .then((all: Playbook[]) => setPlaybook(all.find((p) => p.slug === params.slug) || null));
  }, [params.slug]);

  if (playbook === undefined) return <div className="py-20 text-center text-ink/50">Loading…</div>;
  if (playbook === null) {
    return (
      <div className="py-20 text-center text-ink/50">
        Playbook not found. <Link href="/playbooks" className="text-teal-700 underline">Back to playbooks</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/playbooks" className="mb-4 inline-block text-sm text-teal-700 hover:underline">
        ← Playbooks
      </Link>

      <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Playbook</p>
      <h1 className="text-2xl font-bold sm:text-3xl">{playbook.name}</h1>
      <p className="mt-2 text-ink/65">{playbook.summary}</p>

      <Section title="When to Use">
        <p>{playbook.whenToUse}</p>
      </Section>

      <Section title="What to Check">
        <ul className="list-disc space-y-1 pl-5">
          {playbook.whatToCheck.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Section>

      <Section title="Steps">
        <ol className="space-y-3">
          {playbook.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold text-ink">{s.title}</div>
                <div className="text-ink/70">{s.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {playbook.templates.length > 0 && (
        <Section title="Templates">
          <div className="flex flex-wrap gap-2">
            {playbook.templates.map((t) => (
              <Link
                key={t}
                href={`/templates#${t}`}
                className="focus-ring rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-200"
              >
                {t.replace(/-/g, " ")}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Section title="Follow-Up">
          <p>{playbook.followUp}</p>
        </Section>
        <div className="rounded-lg bg-rust-500/5 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-rust-600">Escalation</div>
          <p className="mt-1 text-sm text-ink/80">{playbook.escalation}</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">{title}</h2>
      <div className="prose-body mt-2 text-sm leading-relaxed text-ink/85">{children}</div>
    </div>
  );
}
