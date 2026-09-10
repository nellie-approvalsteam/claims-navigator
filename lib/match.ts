import Fuse from "fuse.js";
import type { Scenario, Playbook, CommTemplate, FaqArticle } from "./types";

export interface SearchIndexEntry {
  type: "scenario" | "playbook" | "template" | "faq";
  slug: string;
  title: string;
  subtitle: string;
  snippet: string;
  url: string;
}

export function buildSearchIndex(data: {
  scenarios: Scenario[];
  playbooks: Playbook[];
  templates: CommTemplate[];
  faq: FaqArticle[];
}): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = [];

  for (const s of data.scenarios) {
    entries.push({
      type: "scenario",
      slug: s.slug,
      title: s.name,
      subtitle: s.category,
      snippet: s.whatHappened,
      url: `/scenarios/${s.slug}`,
    });
  }
  for (const p of data.playbooks) {
    entries.push({
      type: "playbook",
      slug: p.slug,
      title: p.name,
      subtitle: "Playbook",
      snippet: p.summary,
      url: `/playbooks/${p.slug}`,
    });
  }
  for (const t of data.templates) {
    entries.push({
      type: "template",
      slug: t.slug,
      title: t.title,
      subtitle: `Template · ${t.category}`,
      snippet: t.body.slice(0, 140),
      url: `/templates#${t.slug}`,
    });
  }
  for (const f of data.faq) {
    entries.push({
      type: "faq",
      slug: f.slug,
      title: f.title,
      subtitle: `Knowledge Base · ${f.category}`,
      snippet: f.description,
      url: `/knowledge-base/${f.slug}`,
    });
  }

  return entries;
}

export function searchIndex(entries: SearchIndexEntry[], query: string, limit = 20) {
  if (!query.trim()) return [];
  const fuse = new Fuse(entries, {
    keys: [
      { name: "title", weight: 0.5 },
      { name: "snippet", weight: 0.3 },
      { name: "subtitle", weight: 0.2 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
  });
  return fuse.search(query, { limit }).map((r) => r.item);
}

// "I'm Stuck" mode: match a free-text description of a situation against
// the Scenario Library. Deterministic keyword/fuzzy matching, not an AI
// call (see lib/ai.ts) — keeps this mode fully functional with no
// external dependency, while still feeling like it "understood" the input.
export function matchScenariosToText(scenarios: Scenario[], text: string, limit = 3) {
  if (!text.trim()) return [];
  const fuse = new Fuse(scenarios, {
    keys: [
      { name: "name", weight: 0.25 },
      { name: "whatHappened", weight: 0.25 },
      { name: "category", weight: 0.1 },
      { name: "possibleSolutions", weight: 0.15 },
      { name: "whatToCheck", weight: 0.1 },
      { name: "problemTags", weight: 0.15 },
    ],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
  });
  return fuse.search(text, { limit }).map((r) => ({ scenario: r.item, score: r.score ?? 1 }));
}
