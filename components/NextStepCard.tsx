import type { Recommendation } from "@/lib/decisionEngine";
import SafetyNote from "./SafetyNote";

export default function NextStepCard({ rec }: { rec: Recommendation }) {
  const { nextStep, scoredOptions } = rec;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-teal-700 bg-white p-5 sm:p-6">
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-brass-600">
          Recommended Next Step
        </div>
        <h2 className="text-xl font-bold text-teal-800 sm:text-2xl">{nextStep.title}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Block label="What to do">{nextStep.what}</Block>
          <Block label="Why">{nextStep.why}</Block>
        </div>

        {nextStep.beforeYouStart.length > 0 && (
          <ListBlock label="Before you start" items={nextStep.beforeYouStart} />
        )}
        <ListBlock label="Then" items={nextStep.steps} ordered />
        <ListBlock label="Gather" items={nextStep.gather} />

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Block label="Who to contact">{nextStep.who}</Block>
          <Block label="Document">{nextStep.document}</Block>
          <Block label="Follow up">{nextStep.followUp}</Block>
        </div>

        <div className="mt-4 rounded-lg bg-rust-500/5 p-3">
          <div className="text-xs font-bold uppercase tracking-widest text-rust-600">
            If that doesn&apos;t work
          </div>
          <p className="mt-1 text-sm text-ink/80">{nextStep.ifFails}</p>
        </div>
      </div>

      <div className="rounded-xl border border-teal-100 bg-white p-4 sm:p-5">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">
          Other paths considered
        </div>
        <ul className="space-y-2">
          {scoredOptions.map((opt) => (
            <li key={opt.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink/80">{opt.label}</span>
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink/10">
                <span
                  className="block h-full rounded-full bg-teal-600"
                  style={{ width: `${Math.min(100, (opt.score / 8) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <SafetyNote />
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</div>
      <p className="mt-1 text-sm leading-relaxed text-ink/85">{children}</p>
    </div>
  );
}

function ListBlock({
  label,
  items,
  ordered = false,
}: {
  label: string;
  items: string[];
  ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</div>
      <Tag className={`mt-1 space-y-1 text-sm text-ink/85 ${ordered ? "list-decimal pl-5" : "list-disc pl-5"}`}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </Tag>
    </div>
  );
}
