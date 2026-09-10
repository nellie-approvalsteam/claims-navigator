import type { DecisionRules, NavigatorOptions, NextStepTemplate } from "./types";

export interface NavigatorInput {
  status: string;
  damageType?: string;
  carrier?: string;
  problems: string[];
}

export interface ScoredOption {
  id: string;
  label: string;
  shortLabel: string;
  score: number;
  whenAppropriate: string[];
}

export interface Recommendation {
  scoredOptions: ScoredOption[];
  topOption: ScoredOption;
  nextStep: {
    title: string;
    what: string;
    why: string;
    beforeYouStart: string[];
    steps: string[];
    gather: string[];
    who: string;
    document: string;
    followUp: string;
    ifFails: string;
  };
  likelySituation: string;
}

function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Rule-based, fully deterministic and explainable — no AI call. Sums the
 * configured weight for every selected status/problem tag against each of
 * the five options, then ranks them. Ties are broken by the options[]
 * order in decisionRules.json (earlier wins), which is itself ordered by
 * how commonly each path applies.
 */
export function computeRecommendation(
  input: NavigatorInput,
  rules: DecisionRules,
  navigatorOptions: NavigatorOptions
): Recommendation {
  const scores: Record<string, number> = {};
  for (const opt of rules.options) scores[opt.id] = 0;

  const statusWeights = rules.statusWeights[input.status] || {};
  for (const [optId, w] of Object.entries(statusWeights)) {
    scores[optId] = (scores[optId] ?? 0) + w;
  }

  for (const problem of input.problems) {
    const weights = rules.problemWeights[problem] || {};
    for (const [optId, w] of Object.entries(weights)) {
      scores[optId] = (scores[optId] ?? 0) + w;
    }
  }

  const scoredOptions: ScoredOption[] = rules.options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    shortLabel: opt.shortLabel,
    score: scores[opt.id] ?? 0,
    whenAppropriate: opt.whenAppropriate,
  }));

  scoredOptions.sort((a, b) => b.score - a.score);
  const topOption = scoredOptions[0];

  const damageLabel = navigatorOptions.damageTypes.find((d) => d.id === input.damageType)?.label;
  const statusLabel = navigatorOptions.claimStatuses.find((s) => s.id === input.status)?.label;
  const problemLabels = input.problems
    .map((p) => navigatorOptions.problems.find((x) => x.id === p)?.label)
    .filter((x): x is string => Boolean(x));

  const vars: Record<string, string> = {
    onDamageType: damageLabel && damageLabel !== "Multiple areas" ? ` on the ${damageLabel.toLowerCase()}` : "",
    forCarrier: input.carrier && input.carrier !== "car-other" ? "" : "",
    onProblems: problemLabels.length ? ` — specifically ${problemLabels.join(", ").toLowerCase()}` : "",
  };

  const tpl: NextStepTemplate = rules.nextStepTemplates[topOption.id];

  const nextStep = {
    title: tpl.title,
    what: fillTemplate(tpl.what, vars),
    why: fillTemplate(tpl.why, vars),
    beforeYouStart: tpl.beforeYouStart,
    steps: tpl.steps,
    gather: tpl.gather,
    who: tpl.who,
    document: tpl.document,
    followUp: tpl.followUp,
    ifFails: tpl.ifFails,
  };

  const likelySituation = buildLikelySituation(statusLabel, damageLabel, problemLabels);

  return { scoredOptions, topOption, nextStep, likelySituation };
}

function buildLikelySituation(
  statusLabel: string | undefined,
  damageLabel: string | undefined,
  problemLabels: string[]
): string {
  const parts: string[] = [];
  if (statusLabel) parts.push(`The claim is currently: ${statusLabel.toLowerCase()}.`);
  if (damageLabel) parts.push(`Damage area: ${damageLabel.toLowerCase()}.`);
  if (problemLabels.length) {
    parts.push(
      `Based on what's selected (${problemLabels.join(", ").toLowerCase()}), this looks like a dispute the team has seen before — check the Scenario Library below for the closest match to what's actually happening on this claim.`
    );
  } else {
    parts.push("Select at least one \"current problem\" tag above to get a more specific read.");
  }
  return parts.join(" ");
}
