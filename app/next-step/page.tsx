"use client";

import { useEffect, useState } from "react";
import type { DecisionRules } from "@/lib/types";
import type { Recommendation } from "@/lib/decisionEngine";
import NextStepCard from "@/components/NextStepCard";

export default function NextStepPage() {
  const [rules, setRules] = useState<DecisionRules | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rules").then((r) => r.json()).then(setRules);
  }, []);

  if (!rules) {
    return <div className="py-20 text-center text-ink/50">Loading…</div>;
  }

  const rec: Recommendation | null = chosen
    ? {
        scoredOptions: rules.options.map((o) => ({
          id: o.id,
          label: o.label,
          shortLabel: o.shortLabel,
          score: o.id === chosen ? 5 : 0,
          whenAppropriate: o.whenAppropriate,
        })),
        topOption: {
          id: chosen,
          label: rules.options.find((o) => o.id === chosen)!.label,
          shortLabel: rules.options.find((o) => o.id === chosen)!.shortLabel,
          score: 5,
          whenAppropriate: rules.options.find((o) => o.id === chosen)!.whenAppropriate,
        },
        nextStep: {
          title: rules.nextStepTemplates[chosen].title,
          what: rules.nextStepTemplates[chosen].what.replace(/\{\{\w+\}\}/g, ""),
          why: rules.nextStepTemplates[chosen].why.replace(/\{\{\w+\}\}/g, ""),
          beforeYouStart: rules.nextStepTemplates[chosen].beforeYouStart,
          steps: rules.nextStepTemplates[chosen].steps,
          gather: rules.nextStepTemplates[chosen].gather,
          who: rules.nextStepTemplates[chosen].who,
          document: rules.nextStepTemplates[chosen].document,
          followUp: rules.nextStepTemplates[chosen].followUp,
          ifFails: rules.nextStepTemplates[chosen].ifFails,
        },
        likelySituation: "",
      }
    : null;

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Next Step</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          I know the situation. Tell me what to do next.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          Already know which path you&apos;re considering? Pick it below for the full breakdown —
          what to do, why, what to gather, who to contact, and what to do if it doesn&apos;t work.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rules.options.map((o) => (
          <button
            key={o.id}
            onClick={() => setChosen(o.id)}
            className={`focus-ring rounded-xl border p-4 text-left text-sm font-semibold transition ${
              chosen === o.id
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-teal-100 bg-white text-ink hover:border-teal-600"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {rec ? (
        <NextStepCard rec={rec} />
      ) : (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-teal-200 bg-white/60 p-8 text-center text-sm text-ink/50">
          Pick a path above to see the full next-step breakdown.
        </div>
      )}
    </div>
  );
}
