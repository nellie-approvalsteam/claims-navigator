"use client";

import { useState } from "react";
import Link from "next/link";
import type { Scenario } from "@/lib/types";
import SafetyNote from "@/components/SafetyNote";

interface StuckResponse {
  matched: boolean;
  message?: string;
  best?: Scenario;
  alternates?: Scenario[];
}

const EXAMPLE =
  "State Farm approved the main house but denied the garage because they say the shingles are available. We already have documentation that the shingles are discontinued.";

function inferWhoToContact(s: Scenario): string {
  const cat = s.category.toLowerCase();
  const tags = s.problemTags.join(" ");
  if (cat.includes("client")) return "Client";
  if (cat.includes("appraisal")) return "Appraiser, and the client if it affects timeline";
  if (tags.includes("appraiser")) return "Appraiser";
  if (tags.includes("client")) return "Client";
  if (cat.includes("payment")) return "Carrier / claims department";
  return "Carrier / adjuster";
}

export default function StuckPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<StuckResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Scenario Solver</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">I&apos;m Stuck — Help Me Figure This Out</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          Describe the situation in your own words. Avoid pasting anything you wouldn&apos;t want
          stored — this box isn&apos;t saved anywhere, but keep it to the situation, not personal
          client details.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-teal-100 bg-white p-5 sm:p-6">
        <textarea
          className="field min-h-[120px] resize-y"
          placeholder={EXAMPLE}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="text-xs font-medium text-teal-700 underline underline-offset-2"
            onClick={() => setText(EXAMPLE)}
          >
            Try an example
          </button>
          <button
            type="submit"
            disabled={!text.trim() || loading}
            className="focus-ring rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Thinking…" : "Help me figure this out"}
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-8">
          {!result.matched ? (
            <div className="rounded-2xl border border-dashed border-teal-200 bg-white/70 p-6 text-sm text-ink/70">
              {result.message}
            </div>
          ) : (
            <StuckResult scenario={result.best!} alternates={result.alternates || []} />
          )}
        </div>
      )}

      <div className="mt-8">
        <SafetyNote />
      </div>

      <style jsx global>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d6e3de;
          background: white;
          padding: 0.6rem 0.8rem;
          font-size: 0.9rem;
        }
        .field:focus {
          outline: 2px solid #2f5d50;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function StuckResult({ scenario, alternates }: { scenario: Scenario; alternates: Scenario[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-teal-700 bg-white p-5 sm:p-6">
        <div className="text-xs font-bold uppercase tracking-widest text-brass-600">
          Closest match: {scenario.name}
        </div>

        <ResultBlock label="What I See">{scenario.whatHappened}</ResultBlock>
        <ResultList label="Possible Angles" items={scenario.possibleSolutions} />
        <ResultBlock label="Best Next Move" highlight>
          {scenario.recommendedFirstMove}
        </ResultBlock>
        <ResultList label="What to Gather" items={scenario.supportingDocumentation} />
        <ResultBlock label="Who to Contact">{inferWhoToContact(scenario)}</ResultBlock>
        <ResultBlock label="If That Doesn't Work">{scenario.ifUnsuccessful}</ResultBlock>
        <ResultBlock label="Documentation">
          Log this in Contractors Cloud: what you tried, what you sent, and the response. {scenario.followUp && `Follow up: ${scenario.followUp}.`}
        </ResultBlock>

        <div className="mt-4">
          <Link
            href={`/scenarios/${scenario.slug}`}
            className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            View the full scenario entry →
          </Link>
        </div>
      </div>

      {alternates.length > 0 && (
        <div className="rounded-xl border border-teal-100 bg-white p-4 sm:p-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
            Other possible matches
          </div>
          <ul className="space-y-2">
            {alternates.map((s) => (
              <li key={s.slug}>
                <Link href={`/scenarios/${s.slug}`} className="focus-ring text-sm font-medium text-teal-700 hover:underline">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResultBlock({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`mt-4 ${highlight ? "rounded-lg bg-teal-50 p-3" : ""}`}>
      <div className="text-xs font-bold uppercase tracking-widest text-ink/50">{label}</div>
      <p className="mt-1 text-sm leading-relaxed text-ink/85">{children}</p>
    </div>
  );
}

function ResultList({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-xs font-bold uppercase tracking-widest text-ink/50">{label}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/85">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
