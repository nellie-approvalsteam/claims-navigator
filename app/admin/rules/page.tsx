"use client";

import { useEffect, useState } from "react";
import type { DecisionRules } from "@/lib/types";

export default function RulesAdminPage() {
  const [rules, setRules] = useState<DecisionRules | null>(null);
  const [tab, setTab] = useState<"weights" | "json">("weights");
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then((d) => {
        setRules(d);
        setJsonText(JSON.stringify(d, null, 2));
      });
  }, []);

  async function save(next: DecisionRules) {
    setStatus("Saving…");
    const res = await fetch("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      setRules(next);
      setJsonText(JSON.stringify(next, null, 2));
      setStatus("Saved.");
    } else {
      setStatus("Could not save — check the values and try again.");
    }
    setTimeout(() => setStatus(""), 2500);
  }

  function updateWeight(
    table: "problemWeights" | "statusWeights",
    row: string,
    optionId: string,
    value: number
  ) {
    if (!rules) return;
    const next: DecisionRules = {
      ...rules,
      [table]: {
        ...rules[table],
        [row]: { ...rules[table][row], [optionId]: value },
      },
    };
    setRules(next);
  }

  async function saveJson() {
    let parsed: DecisionRules;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setStatus("That's not valid JSON — nothing was saved.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }
    await save(parsed);
  }

  if (!rules) return <div className="py-20 text-center text-ink/50">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Decision Rules</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        These weights drive the Claim Navigator and &quot;I&apos;m Stuck&quot; recommendations.
        Higher = more strongly indicated for that option. 0 = not relevant, 1 = worth considering, 2
        = commonly right, 3 = strongly indicated.
      </p>

      <div className="mt-4 flex gap-2">
        <TabButton active={tab === "weights"} onClick={() => setTab("weights")}>
          Weight Tables
        </TabButton>
        <TabButton active={tab === "json"} onClick={() => setTab("json")}>
          Advanced (JSON)
        </TabButton>
      </div>

      {status && <p className="mt-3 text-sm font-medium text-teal-700">{status}</p>}

      {tab === "weights" ? (
        <div className="mt-5 space-y-8">
          <WeightTable
            title="By Current Problem"
            rules={rules}
            table="problemWeights"
            onChange={(row, optId, val) => updateWeight("problemWeights", row, optId, val)}
          />
          <WeightTable
            title="By Claim Status"
            rules={rules}
            table="statusWeights"
            onChange={(row, optId, val) => updateWeight("statusWeights", row, optId, val)}
          />
          <button
            onClick={() => save(rules)}
            className="focus-ring rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Save weight changes
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-xs text-ink/50">
            Full rules document, including the option list and the Recommended Next Step text for
            each option ({"{{onDamageType}}"}, {"{{forCarrier}}"}, {"{{onProblems}}"} are filled in
            automatically). Edit with care — this is the same file the app reads directly.
          </p>
          <textarea
            className="w-full rounded-lg border border-teal-100 bg-white p-3 font-mono text-xs"
            rows={28}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          <button
            onClick={saveJson}
            className="focus-ring mt-3 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Save JSON
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
        active ? "bg-teal-700 text-white" : "bg-white text-ink/60 border border-teal-100"
      }`}
    >
      {children}
    </button>
  );
}

function WeightTable({
  title,
  rules,
  table,
  onChange,
}: {
  title: string;
  rules: DecisionRules;
  table: "problemWeights" | "statusWeights";
  onChange: (row: string, optionId: string, value: number) => void;
}) {
  const rows = Object.keys(rules[table]);
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ink/70">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-teal-100 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-teal-100 bg-teal-50">
              <th className="px-3 py-2 text-left font-semibold text-ink/60">Tag</th>
              {rules.options.map((o) => (
                <th key={o.id} className="px-2 py-2 text-center font-semibold text-ink/60">
                  {o.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-50">
            {rows.map((row) => (
              <tr key={row}>
                <td className="px-3 py-1.5 font-mono text-ink/70">{row}</td>
                {rules.options.map((o) => (
                  <td key={o.id} className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={3}
                      className="w-12 rounded border border-teal-100 px-1 py-0.5 text-center"
                      value={rules[table][row][o.id] ?? 0}
                      onChange={(e) => onChange(row, o.id, Number(e.target.value))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
