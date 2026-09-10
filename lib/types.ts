// Shared content types. These mirror the JSON shapes in /content exactly —
// keep them in sync if you add or rename a field there.

export interface Scenario {
  id: string;
  slug: string;
  name: string;
  category: string;
  statusTags: string[];
  problemTags: string[];
  whatHappened: string;
  whatToCheck: string[];
  possibleSolutions: string[];
  recommendedFirstMove: string;
  supportingDocumentation: string[];
  whatToSayWrite: string;
  relatedTemplates: string[];
  followUp: string;
  ifUnsuccessful: string;
  escalationPoint: string;
  lastUpdated: string;
}

export interface PlaybookStep {
  title: string;
  detail: string;
}

export interface Playbook {
  id: string;
  slug: string;
  name: string;
  summary: string;
  whenToUse: string;
  whatToCheck: string[];
  steps: PlaybookStep[];
  templates: string[];
  followUp: string;
  escalation: string;
}

export interface CommTemplate {
  id: string;
  slug: string;
  title: string;
  category: string;
  audience: string;
  body: string;
  tips: string;
}

export interface Carrier {
  id: string;
  name: string;
  notes: string;
  lastUpdated: string;
}

export interface FaqArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  whenToUse: string;
  content: string;
  relatedScenarios: string[];
  lastUpdated: string;
}

export interface OptionMeta {
  id: string;
  label: string;
  shortLabel: string;
  whenAppropriate: string[];
}

export interface NextStepTemplate {
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
}

export interface DecisionRules {
  options: OptionMeta[];
  problemWeights: Record<string, Record<string, number>>;
  statusWeights: Record<string, Record<string, number>>;
  nextStepTemplates: Record<string, NextStepTemplate>;
}

export interface NavigatorOption {
  id: string;
  label: string;
}

export interface NavigatorOptions {
  claimStatuses: NavigatorOption[];
  damageTypes: NavigatorOption[];
  problems: NavigatorOption[];
}

export type ContentType =
  | "scenarios"
  | "playbooks"
  | "templates"
  | "carriers"
  | "faq";

export interface ChangelogEntry {
  id: string;
  type: ContentType | "rules";
  action: "create" | "update" | "delete";
  itemId: string;
  itemLabel: string;
  timestamp: string;
}
