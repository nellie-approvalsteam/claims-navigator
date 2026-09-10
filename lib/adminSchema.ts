import type { ContentType } from "./types";

export type FieldKind = "text" | "textarea" | "list" | "steps";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  help?: string;
  large?: boolean;
}

export const CONTENT_LABELS: Record<ContentType, { singular: string; plural: string }> = {
  scenarios: { singular: "Scenario", plural: "Scenarios" },
  playbooks: { singular: "Playbook", plural: "Playbooks" },
  templates: { singular: "Template", plural: "Templates" },
  carriers: { singular: "Carrier", plural: "Carriers" },
  faq: { singular: "Knowledge Base Article", plural: "Knowledge Base" },
};

export const CONTENT_FIELDS: Record<ContentType, FieldDef[]> = {
  scenarios: [
    { key: "name", label: "Scenario Name", kind: "text" },
    { key: "slug", label: "Slug (URL-safe, unique, e.g. my-scenario)", kind: "text" },
    { key: "category", label: "Category", kind: "text" },
    { key: "statusTags", label: "Status Tags (one per line — match Claim Navigator status ids)", kind: "list" },
    { key: "problemTags", label: "Problem Tags (one per line — match Claim Navigator problem ids)", kind: "list" },
    { key: "whatHappened", label: "What Happened", kind: "textarea" },
    { key: "whatToCheck", label: "What to Check (one per line)", kind: "list" },
    { key: "possibleSolutions", label: "Possible Solutions (one per line)", kind: "list" },
    { key: "recommendedFirstMove", label: "Recommended First Move", kind: "textarea" },
    { key: "supportingDocumentation", label: "Supporting Documentation (one per line)", kind: "list" },
    { key: "whatToSayWrite", label: "What to Say / Write", kind: "textarea" },
    { key: "relatedTemplates", label: "Related Template Slugs (one per line)", kind: "list" },
    { key: "followUp", label: "Follow-Up", kind: "text" },
    { key: "ifUnsuccessful", label: "If Unsuccessful", kind: "textarea" },
    { key: "escalationPoint", label: "Escalation Point", kind: "textarea" },
    { key: "lastUpdated", label: "Last Updated (YYYY-MM-DD)", kind: "text" },
  ],
  playbooks: [
    { key: "name", label: "Playbook Name", kind: "text" },
    { key: "slug", label: "Slug (URL-safe, unique)", kind: "text" },
    { key: "summary", label: "Summary", kind: "textarea" },
    { key: "whenToUse", label: "When to Use", kind: "textarea" },
    { key: "whatToCheck", label: "What to Check (one per line)", kind: "list" },
    { key: "steps", label: "Steps", kind: "steps" },
    { key: "templates", label: "Related Template Slugs (one per line)", kind: "list" },
    { key: "followUp", label: "Follow-Up", kind: "text" },
    { key: "escalation", label: "Escalation", kind: "textarea" },
  ],
  templates: [
    { key: "title", label: "Template Title", kind: "text" },
    { key: "slug", label: "Slug (URL-safe, unique)", kind: "text" },
    { key: "category", label: "Category", kind: "text" },
    { key: "audience", label: "Audience (e.g. Client, Adjuster)", kind: "text" },
    { key: "body", label: "Body (use {{placeholders}} for fill-in fields)", kind: "textarea", large: true },
    { key: "tips", label: "Tips", kind: "textarea" },
  ],
  carriers: [
    { key: "name", label: "Carrier Name", kind: "text" },
    { key: "notes", label: "Notes", kind: "textarea" },
    { key: "lastUpdated", label: "Last Updated (YYYY-MM-DD)", kind: "text" },
  ],
  faq: [
    { key: "title", label: "Title", kind: "text" },
    { key: "slug", label: "Slug (URL-safe, unique)", kind: "text" },
    { key: "category", label: "Category", kind: "text" },
    { key: "description", label: "Description (one-line summary)", kind: "textarea" },
    { key: "whenToUse", label: "When to Use", kind: "textarea" },
    { key: "content", label: "Content", kind: "textarea", large: true },
    { key: "relatedScenarios", label: "Related Scenario Slugs (one per line)", kind: "list" },
    { key: "lastUpdated", label: "Last Updated (YYYY-MM-DD)", kind: "text" },
  ],
};

export function emptyItem(type: ContentType): Record<string, any> {
  const fields = CONTENT_FIELDS[type];
  const item: Record<string, any> = {};
  for (const f of fields) {
    if (f.kind === "list") item[f.key] = [];
    else if (f.kind === "steps") item[f.key] = [];
    else item[f.key] = "";
  }
  if ("lastUpdated" in item) {
    item.lastUpdated = new Date().toISOString().slice(0, 10);
  }
  return item;
}
