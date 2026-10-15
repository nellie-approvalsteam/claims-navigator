// Reads the estimate PDFs in a claim's Contractors Cloud File Cabinet and
// compares the carrier's estimate with ours, so a specialist can see at a
// glance whether the claim was fully denied, partially approved, underpaid,
// or approved — and what the carrier left out.
//
// Everything here is read-only and in-memory: PDFs are downloaded, parsed,
// and discarded. Parsed results are cached briefly by file id + update time.

import { getDocumentProxy } from "unpdf";
import { listProjectFiles, type ProjectFile } from "./contractorsCloud";

export type ClaimOutcome =
  | "fully-denied"
  | "partial-approval"
  | "underpaid"
  | "approved"
  | "carrier-only"
  | "no-carrier-estimate";

export interface EstimateLine {
  description: string;
  quantity: number;
  unit: string;
  total: number;
  // How many line items were combined into this one (e.g. the same window
  // wrap on four elevations).
  count?: number;
}

export interface ParsedEstimate {
  kind: "ours" | "carrier" | "denial-letter";
  fileName: string;
  fileUrl: string;
  fileDate: string | null;
  insurer: string | null;
  claimNumber: string | null;
  dateOfLoss: string | null;
  typeOfLoss: string | null;
  rcv: number | null;
  depreciation: number | null;
  acv: number | null;
  deductible: number | null;
  netClaim: number | null;
  lines: EstimateLine[];
}

export interface ClaimOverview {
  outcome: ClaimOutcome;
  headline: string;
  carrier: ParsedEstimate | null;
  ours: ParsedEstimate | null;
  percentApproved: number | null;
  // Items in our estimate with no counterpart in the carrier's, biggest first.
  leftOut: EstimateLine[];
  leftOutTotal: number;
  // Items both estimates have, where the carrier allowed less than half of
  // ours — e.g. a shingle repair against our full replacement.
  reduced: ReducedItem[];
  filesChecked: number;
}

export interface ReducedItem {
  description: string;
  ours: number;
  carrier: number;
  carrierDescription: string;
}

// Navigator claim status each outcome pre-selects.
export const OUTCOME_STATUS: Partial<Record<ClaimOutcome, string>> = {
  "fully-denied": "fully-denied",
  "partial-approval": "partial-approval",
  underpaid: "underpaid",
  approved: "payment-pending",
};

// Below this share of our estimate the carrier has approved only part of the
// scope (e.g. a shingle repair instead of a replacement); above it, the scope
// is broadly there but priced low.
const PARTIAL_BELOW = 0.5;
// At or above this share the carrier is effectively paying our number.
const APPROVED_AT = 0.95;

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_FILES_TO_READ = 8;
const ESTIMATE_FOLDER_ID = 10; // "Estimates/Proposals"

// Files that are never estimates, judged by name: contracts, licenses,
// measurement reports, our own letters to the carrier.
const NOT_AN_ESTIMATE =
  /(w-?9|licen[cs]e|agreement|disclosure|demand letter|eagle ?view|\bev\b|roofscope|hover|invoice|receipt|contract|declaration|dec page|damage report|lien|w ?9|photo)/i;
const LIKELY_ESTIMATE =
  /(estimate|xactimate|symbility|scope|statement|\bsol\b|settlement|claim|carrier|insurance|denial|letter|supplement|reinspect)/i;

const OUR_COMPANY = /proliance/i;
const DENIAL =
  /(\bdeny\b|\bdenied\b|\bdenial\b|unable to (?:provide|extend|afford) coverage|not covered|no covered (?:damage|loss)|does not exceed (?:your|the) deductible|below (?:your|the) deductible)/i;

// ---- PDF text ----

// Rebuild text lines from pdf.js text items by grouping on the baseline, so
// table rows like "7. R&R Drip edge 239.00 LF 0.59 ..." come out whole.
async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const lines: string[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 40); p++) {
    const page = await pdf.getPage(p);
    const { items } = await page.getTextContent();
    const rows = new Map<number, any[]>();
    for (const it of items as any[]) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5] / 2);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push(it);
    }
    for (const y of Array.from(rows.keys()).sort((a, b) => b - a)) {
      let line = "";
      let end: number | null = null;
      for (const it of rows.get(y)!.sort((a, b) => a.transform[4] - b.transform[4])) {
        const x = it.transform[4];
        if (end !== null && x - end > 0.8) line += " ";
        line += it.str;
        end = x + it.width;
      }
      lines.push(line.replace(/\s+/g, " ").trim());
    }
  }
  return lines;
}

// ---- Parsing ----

const money = (s: string) => Number(s.replace(/[$,()]/g, ""));

function amountAfter(text: string, label: RegExp): number | null {
  const m = text.match(new RegExp(label.source + String.raw`\s*\(?\$?\s*(-?[\d,]+\.\d{2})`, "i"));
  return m ? money(m[1]) : null;
}

function fieldAfter(text: string, label: string, stop: RegExp): string | null {
  const m = text.match(new RegExp(label + String.raw`:\s*(.+)`, "i"));
  if (!m) return null;
  const value = m[1].split(stop)[0].trim();
  return value || null;
}

const UNITS = "EA|SQ|LF|SF|SY|HR|CF|CY|DA|WK|MO|LS|TN|GL|RM";
const LINE_ITEM = new RegExp(
  String.raw`^(\d+)\.\s+(.+?)\s+(-?[\d,]+\.\d+)\s+(${UNITS})\b(.*)$`
);

interface RawLine {
  description: string;
  quantity: number;
  unit: string;
  amounts: number[];
}

function parseLines(lines: string[]): RawLine[] {
  const out: RawLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_ITEM);
    if (!m) continue;
    let description = m[2];
    // Xactimate wraps long descriptions onto the next row.
    const next = lines[i + 1] ?? "";
    if (next && !LINE_ITEM.test(next) && !/\d+\.\d{2}/.test(next) && !/[:]$/.test(next) &&
        !/^(totals?|description|page|[A-Z_]+\s+\d)/i.test(next) && next.length < 50) {
      description += " " + next;
    }
    out.push({
      description: description.replace(/\s+/g, " ").trim(),
      quantity: money(m[3]),
      unit: m[4],
      amounts: (m[5].match(/-?[\d,]+\.\d{2}/g) ?? []).map(money),
    });
  }
  return out;
}

function parseEstimate(lines: string[], file: ProjectFile): ParsedEstimate | null {
  const text = lines.join("\n");
  const head = lines.slice(0, 25).join("\n");
  const rcv = amountAfter(text, /Replacement Cost Value/);
  const isOurs = OUR_COMPANY.test(head);
  const deniesCoverage = DENIAL.test(text);

  let kind: ParsedEstimate["kind"];
  if (isOurs && rcv !== null) kind = "ours";
  else if (!isOurs && rcv !== null) kind = "carrier";
  else if (!isOurs && deniesCoverage && /(claim|policy)/i.test(text)) kind = "denial-letter";
  else return null;

  // Our format ends each row with the line total; the carrier's ends with
  // ACV, so take its RCV — the second amount, after the unit price.
  const items = parseLines(lines).map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    total: kind === "ours" ? l.amounts[l.amounts.length - 1] ?? 0 : l.amounts[1] ?? l.amounts[0] ?? 0,
  }));

  return {
    kind,
    fileName: file.name,
    fileUrl: file.url,
    fileDate: file.updated_at ?? null,
    insurer: isOurs
      ? null
      : fieldAfter(text, "Insurance Company", /\s{2,}|\n/) ??
        // Letters have no "Insurance Company:" field; use the letterhead.
        lines.slice(0, 6).find((l) => /(insurance|casualty|mutual|indemnity)/i.test(l)) ??
        null,
    claimNumber: fieldAfter(text, "(?:Claim Number|File Number)", /\s|\n/),
    dateOfLoss: fieldAfter(text, "Date of Loss", /\s|\n/),
    typeOfLoss: fieldAfter(text, "Type of Loss", /\n/),
    rcv,
    depreciation: amountAfter(text, /Less Depreciation/),
    acv: amountAfter(text, /Actual Cash Value/),
    deductible: amountAfter(text, /Less Deductible/),
    netClaim: amountAfter(text, /Net Claim(?! if)/),
    lines: items,
  };
}

// ---- Comparing line items ----

const FILLER = new Set([
  "r&r", "rr", "remove", "detach", "reset", "and", "the", "per", "up", "to", "of", "w", "with",
  "standard", "grd", "comp", "composition", "high", "profile", "type", "large", "small",
  "labor", "minimum", "charge", "additional", "only", "all", "purpose", "rfg",
]);

function tokens(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .replace(/&/g, " ")
      .split(/[^a-z]+/)
      .map((w) => w.replace(/s$/, ""))
      .filter((w) => w.length > 2 && !FILLER.has(w))
  );
}

function sameItem(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  a.forEach((t) => {
    if (b.has(t)) shared++;
  });
  return shared >= 2 || (shared === 1 && Math.min(a.size, b.size) === 1);
}

// Combine identical line items (the same fascia on every elevation) so each
// shows once with its combined quantity and total.
function grouped(lines: EstimateLine[]): EstimateLine[] {
  const byKey = new Map<string, EstimateLine>();
  for (const l of lines) {
    const key = `${l.description.toLowerCase()}|${l.unit}`;
    const seen = byKey.get(key);
    if (seen) {
      seen.quantity += l.quantity;
      seen.total += l.total;
      seen.count = (seen.count ?? 1) + 1;
    } else {
      byKey.set(key, { ...l, count: 1 });
    }
  }
  return Array.from(byKey.values());
}

const isRemoval = (description: string) => /^remove\b/i.test(description);

function itemsLeftOut(ours: EstimateLine[], carrier: EstimateLine[]): EstimateLine[] {
  const carrierTokens = carrier.map((l) => tokens(l.description));
  return grouped(ours)
    .filter((l) => {
      const t = tokens(l.description);
      return t.size > 0 && !carrierTokens.some((c) => sameItem(t, c));
    })
    .sort((a, b) => b.total - a.total);
}

function itemsReduced(ours: EstimateLine[], carrier: EstimateLine[]): ReducedItem[] {
  const out: ReducedItem[] = [];
  const carrierGroups = grouped(carrier);
  for (const l of grouped(ours)) {
    const t = tokens(l.description);
    // Compare tear-off with tear-off and install with install.
    const matches = carrierGroups
      .map((line) => ({ line, tokens: tokens(line.description) }))
      .filter((c) => isRemoval(c.line.description) === isRemoval(l.description) && sameItem(t, c.tokens));
    if (matches.length === 0) continue;
    const carrierTotal = matches.reduce((sum, c) => sum + c.line.total, 0);
    if (carrierTotal < l.total * 0.5 && l.total - carrierTotal >= 250) {
      out.push({
        description: l.description,
        ours: l.total,
        carrier: carrierTotal,
        carrierDescription: matches.map((c) => c.line.description).join("; "),
      });
    }
  }
  return out.sort((a, b) => b.ours - b.carrier - (a.ours - a.carrier));
}

// ---- Overview ----

const cache = new Map<string, ParsedEstimate | null>();

async function readFile(file: ProjectFile): Promise<ParsedEstimate | null> {
  const key = `${file.id}:${file.updated_at}`;
  if (cache.has(key)) return cache.get(key)!;

  let parsed: ParsedEstimate | null = null;
  try {
    const res = await fetch(file.url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength <= MAX_PDF_BYTES) parsed = parseEstimate(await pdfLines(bytes), file);
    }
  } catch {
    parsed = null;
  }

  if (cache.size > 300) cache.clear();
  cache.set(key, parsed);
  return parsed;
}

function candidateFiles(files: ProjectFile[]): ProjectFile[] {
  return files
    .filter(
      (f) =>
        /pdf/i.test(f.mime_type ?? "") || /\.pdf$/i.test(f.name ?? "")
    )
    .filter((f) => (f.size ?? 0) <= MAX_PDF_BYTES && !NOT_AN_ESTIMATE.test(f.name ?? ""))
    .map((f) => ({
      f,
      rank:
        (f.file_type_id === ESTIMATE_FOLDER_ID ? 2 : 0) + (LIKELY_ESTIMATE.test(f.name) ? 1 : 0),
    }))
    .sort(
      (a, b) =>
        b.rank - a.rank || String(b.f.updated_at).localeCompare(String(a.f.updated_at))
    )
    .slice(0, MAX_FILES_TO_READ)
    .map((x) => x.f);
}

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const newest = (list: ParsedEstimate[]) =>
  list.sort((a, b) => String(b.fileDate).localeCompare(String(a.fileDate)))[0] ?? null;

export async function buildClaimOverview(projectId: number): Promise<ClaimOverview> {
  const files = candidateFiles(await listProjectFiles(projectId));
  const parsed = (await Promise.all(files.map(readFile))).filter(
    (p): p is ParsedEstimate => p !== null
  );

  // The latest carrier document wins: a revised estimate after a
  // reinspection or supplement replaces the earlier one.
  const ours = newest(parsed.filter((p) => p.kind === "ours"));
  const carrierDocs = parsed.filter((p) => p.kind !== "ours");
  const carrier = newest(carrierDocs);
  const base = { carrier, ours, filesChecked: files.length };

  if (!carrier) {
    return {
      ...base,
      outcome: "no-carrier-estimate",
      headline: "No carrier estimate or decision letter found in the File Cabinet yet.",
      percentApproved: null,
      leftOut: [],
      leftOutTotal: 0,
      reduced: [],
    };
  }

  // A denial letter has no line items, so "left out" would just be our
  // whole estimate.
  const leftOut =
    ours && carrier.kind === "carrier" ? itemsLeftOut(ours.lines, carrier.lines) : [];
  const leftOutTotal = leftOut.reduce((sum, l) => sum + l.total, 0);
  const reduced =
    ours && carrier.kind === "carrier" ? itemsReduced(ours.lines, carrier.lines) : [];
  const insurer = carrier.insurer ?? "The carrier";
  const pct = ours?.rcv && carrier.rcv !== null ? carrier.rcv / ours.rcv : null;
  const withPct = (outcome: ClaimOutcome, headline: string): ClaimOverview => ({
    ...base,
    outcome,
    headline,
    percentApproved: pct,
    leftOut,
    leftOutTotal,
    reduced,
  });

  if (carrier.kind === "denial-letter") {
    return withPct("fully-denied", `${insurer} sent a denial (${carrier.fileName}).`);
  }

  const rcv = carrier.rcv ?? 0;
  const belowDeductible =
    (carrier.netClaim !== null && carrier.netClaim <= 0) ||
    (carrier.deductible !== null && rcv <= carrier.deductible);
  if (rcv === 0 || belowDeductible) {
    return withPct(
      "fully-denied",
      `${insurer}'s estimate comes to ${fmt(rcv)}` +
        (carrier.deductible !== null ? `, at or below the ${fmt(carrier.deductible)} deductible` : "") +
        " — nothing is payable."
    );
  }

  const approved =
    `${insurer} approved ${fmt(rcv)} RCV` +
    (carrier.netClaim !== null ? ` (${fmt(carrier.netClaim)} net after deductible)` : "");

  if (pct === null) {
    return withPct(
      "carrier-only",
      `${approved}. Add our estimate to the File Cabinet to compare it against our number.`
    );
  }

  const ofOurs = ` — ${Math.round(pct * 100)}% of our ${fmt(ours!.rcv!)} estimate.`;
  if (pct < PARTIAL_BELOW) return withPct("partial-approval", approved + ofOurs);
  if (pct < APPROVED_AT) return withPct("underpaid", approved + ofOurs);
  return withPct("approved", approved + ofOurs);
}
