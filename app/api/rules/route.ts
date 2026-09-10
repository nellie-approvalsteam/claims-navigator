import { NextRequest, NextResponse } from "next/server";
import { getDecisionRules, saveDecisionRules } from "@/lib/content";
import { isAdminRequest } from "@/lib/auth";
import type { DecisionRules } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rules = await getDecisionRules();
  return NextResponse.json(rules);
}

export async function PUT(req: NextRequest) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  let body: DecisionRules;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.options || !body.problemWeights || !body.statusWeights || !body.nextStepTemplates) {
    return NextResponse.json({ error: "Malformed rules payload." }, { status: 400 });
  }
  await saveDecisionRules(body);
  return NextResponse.json({ ok: true });
}
