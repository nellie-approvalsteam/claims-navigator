// Read-only Notion client used by Claim Lookup. Server-side only.
//
// Configuration (see .env.example):
//   NOTION_API_KEY            — an internal integration secret. Create it at
//                               notion.so/profile/integrations, then open the
//                               "Approvals Team Workspace" page → ••• →
//                               Connections → add the integration, so it can
//                               read that page and everything under it.
//   NOTION_CITIES_DATABASE_ID — the Building Codes → "Illinois Cities"
//                               database (default below).

const NOTION_VERSION = "2022-06-28";
const DEFAULT_CITIES_DB = "af22398c211045178f8daf441c9be7df";
const PAGE_CACHE_MS = 10 * 60 * 1000;

export interface NotionPageRef {
  id: string;
  title: string;
  url: string;
}

export interface CityCodes {
  city: string;
  url: string;
  researchStatus: string | null;
  codeEdition: string | null;
  iceAndWater: string | null;
  dripEdge: string | null;
  maxRoofLayers: string | null;
  reroofPermit: string | null;
  otherItems: string[];
  notes: string;
  codeSource: string | null;
  deptPhone: string | null;
  deptWebsite: string | null;
}

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_API_KEY);
}

function citiesDbId(): string {
  return (process.env.NOTION_CITIES_DATABASE_ID || DEFAULT_CITIES_DB).replace(/-/g, "");
}

async function notionPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Notion returned ${res.status}`);
  }
  return res.json();
}

function plain(rich: any[] | undefined): string {
  return (rich ?? []).map((r) => r.plain_text ?? "").join("");
}

function pageTitle(page: any): string {
  for (const prop of Object.values<any>(page.properties ?? {})) {
    if (prop?.type === "title") return plain(prop.title);
  }
  return "";
}

// ---- Building codes for the claim's city ----

export async function getCityCodes(city: string): Promise<CityCodes | null> {
  const json = await notionPost(`/databases/${citiesDbId()}/query`, {
    filter: { property: "City", title: { equals: city.trim() } },
    page_size: 1,
  });
  const page = json.results?.[0];
  if (!page) return null;

  const p = page.properties ?? {};
  const select = (name: string) => p[name]?.select?.name ?? null;
  return {
    city: pageTitle(page),
    url: page.url,
    researchStatus: select("Research status"),
    codeEdition: select("Code edition"),
    iceAndWater: select("Ice & water shield"),
    dripEdge: select("Drip edge"),
    maxRoofLayers: select("Max roof layers"),
    reroofPermit: select("Reroof permit"),
    otherItems: (p["Other code items"]?.multi_select ?? []).map((o: any) => o.name),
    notes: plain(p["Notes"]?.rich_text),
    codeSource: p["Code source"]?.url ?? null,
    deptPhone: p["Building dept phone"]?.phone_number ?? null,
    deptWebsite: p["Building dept website"]?.url ?? null,
  };
}

// ---- Resource pages (playbooks, resource kits, knowledge base) ----

let pageCache: { at: number; pages: NotionPageRef[] } | null = null;

// Every page the integration has been shared into, minus the per-city rows
// (those are surfaced through getCityCodes instead). Cached briefly so a
// lookup doesn't page through the whole workspace each time.
async function listResourcePages(): Promise<NotionPageRef[]> {
  if (pageCache && Date.now() - pageCache.at < PAGE_CACHE_MS) return pageCache.pages;

  const pages: NotionPageRef[] = [];
  const citiesDb = citiesDbId();
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const json = await notionPost("/search", {
      filter: { property: "object", value: "page" },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const page of json.results ?? []) {
      if (page.archived || page.in_trash) continue;
      if (page.parent?.database_id?.replace(/-/g, "") === citiesDb) continue;
      const title = pageTitle(page);
      if (title) pages.push({ id: page.id, title, url: page.url });
    }
    if (!json.has_more) break;
    cursor = json.next_cursor;
  }

  pageCache = { at: Date.now(), pages };
  return pages;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "they", "their", "claim", "claims",
  "client", "project", "have", "has", "was", "were", "not", "but", "are", "our", "into",
  // Words that appear in nearly every claim conversation and resource, so
  // they'd match everything rather than point at anything.
  "carrier", "insurance", "damage", "missing", "says", "said", "issue", "problem",
]);

export function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9&]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    )
  );
}

// Two words count as the same when they share a prefix of at least four
// letters covering most of the shorter word, so "denied" finds "Denial" and
// "appraiser" finds "Appraisal" but "appraisal" doesn't find "Approvals".
export function sameStem(a: string, b: string): boolean {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n >= 4 && n >= 0.6 * Math.min(a.length, b.length);
}

// Rank pages by how many of the claim's keywords appear in the title.
export async function findResourcePages(terms: string[], limit = 6): Promise<NotionPageRef[]> {
  if (terms.length === 0) return [];
  const pages = await listResourcePages();
  return pages
    .map((page) => {
      const words = keywords(page.title);
      const score = terms.filter((t) => words.some((w) => sameStem(t, w))).length;
      return { page, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.page);
}
