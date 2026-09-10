import { NextRequest, NextResponse } from "next/server";
import { getDecisionRules, getNavigatorOptions } from "@/lib/content";
import { computeRecommendation, type NavigatorInput } from "@/lib/decisionEngine";

export async function POST(req: NextRequest) {
  let body: Partial<NavigatorInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: "A claim status is required." }, { status: 400 });
  }

  const input: NavigatorInput = {
    status: body.status,
    damageType: body.damageType,
    carrier: body.carrier,
    problems: Array.isArray(body.problems) ? body.problems : [],
  };

  const [rules, navigatorOptions] = await Promise.all([
    getDecisionRules(),
    getNavigatorOptions(),
  ]);

  const recommendation = computeRecommendation(input, rules, navigatorOptions);
  return NextResponse.json(recommendation);
}
