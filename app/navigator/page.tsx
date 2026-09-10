"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Recommendation } from "@/lib/decisionEngine";
import type { NavigatorOption, Scenario, Carrier } from "@/lib/types";
import NextStepCard from "@/components/NextStepCard";
import SafetyNote from "@/components/SafetyNote";

interface OptionsData {
  claimStatuses: NavigatorOption[];
  damageTypes: NavigatorOption[];
  problems: NavigatorOption[];
  carriers: Carrier[];
}

export default function NavigatorPage() {
  const [options, setOptions] = useState<OptionsData | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [damageType, setDamageType] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [carrierQuery, setCarrierQuery] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/navigator-options").then((r) => r.json()).then(setOptions);
    fetch("/api/content/scenarios").then((r) => r.json()).then(setScenarios);
  }, []);

  const filteredCarriers = useMemo(() => {
    if (!options) return [];
    if (!carrierQuery.trim()) return options.carriers;
    const q = carrierQuery.toLowerCase();
    return options.carriers.filter((c) => c.name.toLowerCase().includes(q));
  }, [options, carrierQuery]);

  const relatedScenarios = useMemo(() => {
    if (problems.length === 0 && !status) return [];
    return scenarios
      .filter(
        (s) =>
          s.problemTags.some((t) => problems.includes(t)) ||
          (status && s.statusTags.includes(status))
      )
      .slice(0, 4);
  }, [scenarios, problems, status]);

  function toggleProblem(id: string) {
    setProblems((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return;
    setLoading(true);
    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, damageType, carrier, problems }),
      });
      const data = await res.json();
      setRec(data);
    } finally {
      setLoading(false);
    }
  }

  if (!options) {
    return <div className="py-20 text-center text-ink/50">Loading…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Claim Navigator</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">What&apos;s happening with the claim?</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          Nothing entered here is saved — this is a quick, session-only read on the situation. No
          claim number or client name needed.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-teal-100 bg-white p-5 sm:p-6">
          <Field label="Claim status" required>
            <select
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              <option value="">Select a status…</option>
              {options.claimStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Carrier">
            <input
              className="field mb-2"
              placeholder="Search carriers…"
              value={carrierQuery}
              onChange={(e) => setCarrierQuery(e.target.value)}
            />
            <select className="field" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
              <option value="">Not specified</option>
              {filteredCarriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Damage type">
            <select className="field" value={damageType} onChange={(e) => setDamageType(e.target.value)}>
              <option value="">Not specified</option>
              {options.damageTypes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Current problem (select all that apply)">
            <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-teal-100 p-3 sm:grid-cols-2">
              {options.problems.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-teal-50">
                  <input
                    type="checkbox"
                    checked={problems.includes(p.id)}
                    onChange={() => toggleProblem(p.id)}
                    className="h-4 w-4 accent-teal-700"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </Field>

          <button
            type="submit"
            disabled={!status || loading}
            className="focus-ring w-full rounded-lg bg-teal-700 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Analyzing…" : "Show me my options"}
          </button>
        </form>

        <div>
          {rec ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-teal-100 bg-white p-5 sm:p-6">
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-ink/50">
                  What&apos;s Likely Happening
                </div>
                <p className="text-sm leading-relaxed text-ink/85">{rec.likelySituation}</p>
              </div>
              <NextStepCard rec={rec} />
              {relatedScenarios.length > 0 && (
                <div className="rounded-2xl border border-teal-100 bg-white p-5 sm:p-6">
                  <div className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/50">
                    Closest matching scenarios
                  </div>
                  <ul className="space-y-2">
                    {relatedScenarios.map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/scenarios/${s.slug}`}
                          className="focus-ring block rounded-lg border border-teal-100 p-3 text-sm hover:border-teal-600"
                        >
                          <span className="font-semibold text-teal-800">{s.name}</span>
                          <span className="mt-0.5 block text-ink/60">{s.whatHappened}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-teal-200 bg-white/60 p-8 text-center text-sm text-ink/50">
              Fill in the claim status (and any other details you know) and submit to see the likely
              situation, your options, and a recommended next step.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <SafetyNote />
      </div>

      <style jsx global>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d6e3de;
          background: white;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
        }
        .field:focus {
          outline: 2px solid #2f5d50;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink/80">
        {label} {required && <span className="text-rust-600">*</span>}
      </label>
      {children}
    </div>
  );
}
