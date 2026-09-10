"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/types";
import Badge from "@/components/Badge";

export default function ScenarioDetailPage({ params }: { params: { slug: string } }) {
  const [scenario, setScenario] = useState<Scenario | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/content/scenarios")
      .then((r) => r.json())
      .then((all: Scenario[]) => {
        setScenario(all.find((s) => s.slug === params.slug) || null);
      });
  }, [params.slug]);

  if (scenario === undefined) {
    return <div className="py-20 text-center text-ink/50">Loading…</div>;
  }
  if (scenario === null) {
    return (
      <div className="py-20 text-center text-ink/50">
        Scenario not found. <Link href="/scenarios" className="text-teal-700 underline">Back to library</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/scenarios" className="mb-4 inline-block text-sm text-teal-700 hover:underline">
        ← Scenario Library
      </Link>

      <div className="mb-2 flex items-center gap-2">
        <Badge>{scenario.category}</Badge>
        <span className="text-xs text-ink/40">Updated {scenario.lastUpdated}</span>
      </div>
      <h1 className="text-2xl font-bold sm:text-3xl">{scenario.name}</h1>

      <Section title="What Happened">
        <p>{scenario.whatHappened}</p>
      </Section>

      <Section title="What to Check">
        <BulletList items={scenario.whatToCheck} />
      </Section>

      <Section title="Possible Solutions">
        <BulletList items={scenario.possibleSolutions} />
      </Section>

      <Section title="Recommended First Move" highlight>
        <p>{scenario.recommendedFirstMove}</p>
      </Section>

      <Section title="Supporting Documentation">
        <BulletList items={scenario.supportingDocumentation} />
      </Section>

      <Section title="What to Say / Write">
        <p>{scenario.whatToSayWrite}</p>
      </Section>

      {scenario.relatedTemplates.length > 0 && (
        <Section title="Related Templates">
          <div className="flex flex-wrap gap-2">
            {scenario.relatedTemplates.map((t) => (
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
          <p>{scenario.followUp}</p>
        </Section>
        <Section title="If Unsuccessful">
          <p>{scenario.ifUnsuccessful}</p>
        </Section>
      </div>

      <div className="mt-6 rounded-lg bg-rust-500/5 p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-rust-600">
          Escalation Point
        </div>
        <p className="mt-1 text-sm text-ink/80">{scenario.escalationPoint}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`mt-6 ${highlight ? "rounded-xl bg-teal-50 p-4" : ""}`}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink/50">{title}</h2>
      <div className="prose-body mt-2 text-sm leading-relaxed text-ink/85">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <p className="text-ink/40">—</p>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
