import { NextRequest, NextResponse } from "next/server";
import { isTeamRequest } from "@/lib/auth";
import { ContractorsCloudError, searchClaims } from "@/lib/contractorsCloud";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isTeamRequest()) {
    return NextResponse.json({ error: "Enter the team passphrase first." }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ error: "Type at least two characters." }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  }

  try {
    return NextResponse.json({ results: await searchClaims(q) });
  } catch (e) {
    const err = e instanceof ContractorsCloudError ? e : new ContractorsCloudError("Search failed.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
