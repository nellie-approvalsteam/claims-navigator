"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FaqArticle, Scenario } from "@/lib/types";
import Badge from "@/components/Badge";

export default function KbDetailPage({ params }: { params: { slug: string } }) {
  const [article, setArticle] = useState<FaqArticle | null | undefined>(undefined);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    fetch("/api/content/faq")
      .then((r) => r.json())
      .then((all: FaqArticle[]) => setArticle(all.find((a) => a.slug === params.slug) || null));
    fetch("/api/content/scenarios").then((r) => r.json()).then(setScenarios);
  }, [params.slug]);

  if (article === undefined) return <div className="py-20 text-center text-ink/50">Loading…</div>;
  if (article === null) {
    return (
      <div className="py-20 text-center text-ink/50">
        Article not found.{" "}
        <Link href="/knowledge-base" className="text-teal-700 underline">
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  const related = scenarios.filter((s) => article.relatedScenarios.includes(s.slug));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/knowledge-base" className="mb-4 inline-block text-sm text-teal-700 hover:underline">
        ← Knowledge Base
      </Link>

      <Badge color="brass">{article.category}</Badge>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{article.title}</h1>
      <p className="mt-2 text-ink/65">{article.description}</p>

      <div className="prose-body mt-6 whitespace-pre-line text-sm leading-relaxed text-ink/85">
        {article.content}
      </div>

      {related.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
            Related Scenarios
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map((s) => (
              <Link
                key={s.slug}
                href={`/scenarios/${s.slug}`}
                className="focus-ring rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-200"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-ink/40">Last updated {article.lastUpdated}</p>
    </div>
  );
}
