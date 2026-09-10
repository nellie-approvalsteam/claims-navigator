import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import type {
  Scenario,
  Playbook,
  CommTemplate,
  Carrier,
  FaqArticle,
  DecisionRules,
  NavigatorOptions,
  ContentType,
  ChangelogEntry,
} from "./types";

// All content lives in flat JSON files under /content, read and written
// directly with the filesystem. This is intentional: it keeps the data
// human-readable and git-diffable, and lets a non-developer admin edit
// content either through the /admin UI (which calls the functions below)
// or by opening the JSON file directly, without touching application code.
//
// This requires a host with a writable, persistent filesystem across
// requests (e.g. Railway, Render, a VPS) — see README.md. It will NOT
// persist admin edits on a stateless/serverless host like Vercel unless
// you swap this module for a real database; every function here is
// intentionally isolated so that swap only touches this one file.

const CONTENT_DIR = path.join(process.cwd(), "content");

const FILES: Record<ContentType, string> = {
  scenarios: "scenarios.json",
  playbooks: "playbooks.json",
  templates: "templates.json",
  carriers: "carriers.json",
  faq: "faq.json",
};

async function readJson<T>(filename: string): Promise<T> {
  const filePath = path.join(CONTENT_DIR, filename);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filename: string, data: unknown): Promise<void> {
  const filePath = path.join(CONTENT_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function appendChangelog(entry: Omit<ChangelogEntry, "id" | "timestamp">) {
  const log = await readJson<ChangelogEntry[]>("changelog.json").catch(
    () => [] as ChangelogEntry[]
  );
  const full: ChangelogEntry = {
    ...entry,
    id: nanoid(8),
    timestamp: new Date().toISOString(),
  };
  log.unshift(full);
  // Keep the changelog from growing without bound.
  await writeJson("changelog.json", log.slice(0, 500));
}

export async function getChangelog(): Promise<ChangelogEntry[]> {
  return readJson<ChangelogEntry[]>("changelog.json").catch(() => [] as ChangelogEntry[]);
}

// ---- Generic list/save helpers per content type ----

export async function listContent<T>(type: ContentType): Promise<T[]> {
  return readJson<T[]>(FILES[type]);
}

export async function getContentBySlug<T extends { slug: string }>(
  type: ContentType,
  slug: string
): Promise<T | undefined> {
  const items = await listContent<T>(type);
  return items.find((i) => i.slug === slug);
}

export async function getContentById<T extends { id: string }>(
  type: ContentType,
  id: string
): Promise<T | undefined> {
  const items = await listContent<T>(type);
  return items.find((i) => i.id === id);
}

function labelFor(type: ContentType, item: any): string {
  return item.name || item.title || item.slug || item.id;
}

export async function createContent<T extends { id: string }>(
  type: ContentType,
  item: T
): Promise<T> {
  const items = await listContent<T>(type);
  items.push(item);
  await writeJson(FILES[type], items);
  await appendChangelog({
    type,
    action: "create",
    itemId: item.id,
    itemLabel: labelFor(type, item),
  });
  return item;
}

export async function updateContent<T extends { id: string }>(
  type: ContentType,
  id: string,
  updates: Partial<T>
): Promise<T | undefined> {
  const items = await listContent<T>(type);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...updates };
  await writeJson(FILES[type], items);
  await appendChangelog({
    type,
    action: "update",
    itemId: id,
    itemLabel: labelFor(type, items[idx]),
  });
  return items[idx];
}

export async function deleteContent(type: ContentType, id: string): Promise<boolean> {
  const items = await listContent<any>(type);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  const [removed] = items.splice(idx, 1);
  await writeJson(FILES[type], items);
  await appendChangelog({
    type,
    action: "delete",
    itemId: id,
    itemLabel: labelFor(type, removed),
  });
  return true;
}

// ---- Typed convenience wrappers ----

export const getScenarios = () => listContent<Scenario>("scenarios");
export const getPlaybooks = () => listContent<Playbook>("playbooks");
export const getTemplates = () => listContent<CommTemplate>("templates");
export const getCarriers = () => listContent<Carrier>("carriers");
export const getFaqArticles = () => listContent<FaqArticle>("faq");

export const getScenario = (slug: string) => getContentBySlug<Scenario>("scenarios", slug);
export const getPlaybook = (slug: string) => getContentBySlug<Playbook>("playbooks", slug);
export const getTemplate = (slug: string) => getContentBySlug<CommTemplate>("templates", slug);
export const getFaqArticle = (slug: string) => getContentBySlug<FaqArticle>("faq", slug);

// ---- Decision rules (single-document content, not a list) ----

export async function getDecisionRules(): Promise<DecisionRules> {
  return readJson<DecisionRules>("decisionRules.json");
}

export async function saveDecisionRules(rules: DecisionRules): Promise<void> {
  await writeJson("decisionRules.json", rules);
  await appendChangelog({
    type: "rules",
    action: "update",
    itemId: "decisionRules",
    itemLabel: "Decision rules / weights",
  });
}

export async function getNavigatorOptions(): Promise<NavigatorOptions> {
  return readJson<NavigatorOptions>("navigatorOptions.json");
}

export function newId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}
