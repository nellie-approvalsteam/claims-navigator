import { NextResponse } from "next/server";
import { getScenarios, getPlaybooks, getTemplates, getFaqArticles } from "@/lib/content";
import { buildSearchIndex } from "@/lib/match";

export const dynamic = "force-dynamic";

export async function GET() {
  const [scenarios, playbooks, templates, faq] = await Promise.all([
    getScenarios(),
    getPlaybooks(),
    getTemplates(),
    getFaqArticles(),
  ]);
  const index = buildSearchIndex({ scenarios, playbooks, templates, faq });
  return NextResponse.json(index);
}
