import { NextRequest, NextResponse } from "next/server";
import { getScenarios } from "@/lib/content";
import { matchScenariosToText } from "@/lib/match";

export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Describe the situation first." }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "That's a lot — try trimming it to the key details." }, { status: 400 });
  }

  const scenarios = await getScenarios();
  const matches = matchScenariosToText(scenarios, text, 3);

  if (matches.length === 0) {
    return NextResponse.json({
      matched: false,
      message:
        "Nothing in the Scenario Library closely matches this yet. Try the Claim Navigator instead, browse Playbooks, or flag this as a new scenario for an admin to add.",
    });
  }

  return NextResponse.json({
    matched: true,
    best: matches[0].scenario,
    alternates: matches.slice(1).map((m) => m.scenario),
  });
}
