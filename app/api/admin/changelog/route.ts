import { NextResponse } from "next/server";
import { getChangelog } from "@/lib/content";
import { isAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const log = await getChangelog();
  return NextResponse.json(log);
}
