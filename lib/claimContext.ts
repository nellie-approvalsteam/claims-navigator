import type { ClaimSummary } from "./contractorsCloud";
import { keywords, sameStem } from "./notion";

// Words in a Contractors Cloud status/milestone name that say something
// about where the claim is. Everything else in those names ("Part 2/2",
// "Active", "Lead") is workflow noise and would drag in unrelated pages.
const CLAIM_VOCABULARY = [
  "appraisal", "appraiser", "umpire", "supplement", "reinspection", "reinspect", "inspection",
  "adjuster", "denial", "denied", "itel", "matching", "code", "codes", "payment", "depreciation",
  "mortgage", "estimate", "scope", "underpaid", "dispute", "escalation", "documentation",
];

// First matching rule wins, so more specific stages sit above general ones.
const STATUS_RULES: { pattern: RegExp; status: string }[] = [
  { pattern: /appraisal.*award|award/i, status: "appraisal-award-received" },
  { pattern: /appraisal.*(demand|invoke)/i, status: "appraisal-demand-sent" },
  { pattern: /apprais|umpire/i, status: "appraisal-in-progress" },
  { pattern: /re-?inspect/i, status: "reinspection-requested" },
  { pattern: /denied|denial/i, status: "fully-denied" },
  { pattern: /partial/i, status: "partial-approval" },
  { pattern: /supplement|underpa/i, status: "underpaid" },
  { pattern: /adjuster|inspection/i, status: "inspection-pending" },
  { pattern: /payment|depreciation|mortgage|check/i, status: "payment-pending" },
  { pattern: /file claim|claim filed/i, status: "new-claim" },
];

export function suggestNavigatorStatus(claim: ClaimSummary): string | null {
  const text = `${claim.milestone ?? ""} ${claim.status ?? ""}`;
  return STATUS_RULES.find((r) => r.pattern.test(text))?.status ?? null;
}

// Search terms for finding resources: everything the specialist typed about
// the problem, plus any claim-stage words from the Contractors Cloud record.
export function resourceTerms(claim: ClaimSummary, issue: string): string[] {
  const stageWords = keywords(`${claim.milestone ?? ""} ${claim.status ?? ""}`).filter((w) =>
    CLAIM_VOCABULARY.some((v) => sameStem(v, w))
  );
  return Array.from(new Set([...keywords(issue), ...stageWords]));
}
