import { NextRequest, NextResponse } from "next/server";
import { isTeamRequest } from "@/lib/auth";
import { ContractorsCloudError, getClaimNotes } from "@/lib/contractorsCloud";
import { buildNotesBrief } from "@/lib/claimNotes";

export const dynamic = "force-dynamic";

// Notes are read live and returned to the browser; nothing is stored or
// logged here (see README §15).
export async function GET(req: NextRequest) {
  if (!isTeamRequest()) {
    return NextResponse.json({ error: "Enter the team passphrase first." }, { status: 401 });
  }

  const projectId = Number(req.nextUrl.searchParams.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: "Pick a claim first." }, { status: 400 });
  }

  try {
    const { notes, truncated } = await getClaimNotes(projectId);
    return NextResponse.json(buildNotesBrief(notes, truncated));
  } catch (e) {
    const err = e instanceof ContractorsCloudError ? e : new ContractorsCloudError("Couldn't load notes.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
