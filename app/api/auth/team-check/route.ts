import { NextResponse } from "next/server";
import { isTeamRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ authed: isTeamRequest() });
}
