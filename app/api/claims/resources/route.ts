import { NextRequest, NextResponse } from "next/server";
import { isTeamRequest } from "@/lib/auth";
import { ContractorsCloudError, getClaim } from "@/lib/contractorsCloud";
import {
  findResourcePages,
  getCityCodes,
  isNotionConfigured,
  type CityCodes,
  type NotionPageRef,
} from "@/lib/notion";
import { resourceTerms, suggestNavigatorStatus } from "@/lib/claimContext";
import { getScenarios, getPlaybooks, getTemplates, getFaqArticles } from "@/lib/content";
import { buildSearchIndex, searchIndex, type SearchIndexEntry } from "@/lib/match";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isTeamRequest()) {
    return NextResponse.json({ error: "Enter the team passphrase first." }, { status: 401 });
  }

  let body: { projectId?: number; issue?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const projectId = Number(body.projectId);
  const issue = (body.issue || "").slice(0, 1000);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: "Pick a claim first." }, { status: 400 });
  }

  // Re-read the claim from Contractors Cloud rather than trusting whatever
  // the browser sent, so the city and stage are always the real ones.
  let claim;
  try {
    claim = await getClaim(projectId);
  } catch (e) {
    const err = e instanceof ContractorsCloudError ? e : new ContractorsCloudError("Lookup failed.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (!claim) {
    return NextResponse.json({ error: "That claim wasn't found in Contractors Cloud." }, { status: 404 });
  }

  const suggestedStatus = suggestNavigatorStatus(claim);
  const terms = resourceTerms(claim, issue);

  // Notion is optional: if it's down or not configured, the rest still works.
  let notion: {
    status: "ok" | "not-configured" | "error";
    cityCodes: CityCodes | null;
    pages: NotionPageRef[];
  } = { status: "not-configured", cityCodes: null, pages: [] };
  if (isNotionConfigured()) {
    try {
      const [cityCodes, pages] = await Promise.all([
        claim.city ? getCityCodes(claim.city) : Promise.resolve(null),
        findResourcePages(terms),
      ]);
      notion = { status: "ok", cityCodes, pages };
    } catch {
      notion = { status: "error", cityCodes: null, pages: [] };
    }
  }

  const [scenarios, playbooks, templates, faq] = await Promise.all([
    getScenarios(),
    getPlaybooks(),
    getTemplates(),
    getFaqArticles(),
  ]);
  const index = buildSearchIndex({ scenarios, playbooks, templates, faq });

  // Scenarios tagged with the claim's likely stage come first, then anything
  // matching the specialist's own words, ranked by how many terms hit it.
  const internal: SearchIndexEntry[] = [];
  const seen = new Set<string>();
  const add = (e: SearchIndexEntry) => {
    const key = `${e.type}:${e.slug}`;
    if (!seen.has(key)) {
      seen.add(key);
      internal.push(e);
    }
  };
  if (suggestedStatus) {
    const tagged = new Set(
      scenarios.filter((s) => s.statusTags.includes(suggestedStatus)).map((s) => s.slug)
    );
    index.filter((e) => e.type === "scenario" && tagged.has(e.slug)).slice(0, 3).forEach(add);
  }
  const hits = new Map<string, { entry: SearchIndexEntry; count: number }>();
  for (const term of terms) {
    // Single keywords need a tighter match than a full search query, or
    // short words like "edge" fuzzily hit unrelated titles.
    for (const entry of searchIndex(index, term, 8, 0.2)) {
      const key = `${entry.type}:${entry.slug}`;
      const hit = hits.get(key) ?? { entry, count: 0 };
      hit.count++;
      hits.set(key, hit);
    }
  }
  Array.from(hits.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .forEach((h) => add(h.entry));

  return NextResponse.json({ claim, suggestedStatus, terms, notion, internal });
}
