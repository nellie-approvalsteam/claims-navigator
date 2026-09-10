// Stub interface for a future AI-powered layer (e.g. a smarter "I'm Stuck"
// free-text analysis, or claim document extraction — see the "Future-Ready
// Design" section of README.md). Nothing in v1 calls this: "I'm Stuck"
// mode works today using deterministic keyword/fuzzy matching against the
// Scenario Library (see lib/match.ts), so the tool is fully functional
// with zero AI dependency and zero API key required.
//
// If/when you want to wire in a real model, implement generate() below
// using whichever provider you choose, reading the key from an
// environment variable (never hard-code it, never ship it to the
// frontend) so the provider can be swapped without touching any calling
// code. AI_PROVIDER/AI_API_KEY are read here and nowhere else.

export interface AiGenerateInput {
  prompt: string;
  context?: string;
}

export interface AiGenerateResult {
  text: string;
}

export async function isAiConfigured(): Promise<boolean> {
  return Boolean(process.env.AI_API_KEY);
}

export async function generate(_input: AiGenerateInput): Promise<AiGenerateResult> {
  throw new Error(
    "No AI provider is configured. This app does not require one — see lib/ai.ts for how to wire one in later."
  );
}
