import { NextRequest, NextResponse } from "next/server";
import {
  checkTeamPassword,
  createSessionToken,
  SESSION_TTL_SECONDS,
  TEAM_SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ error: "Passphrase required." }, { status: 400 });
  }

  let ok: boolean;
  try {
    ok = checkTeamPassword(body.password);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  if (!ok) {
    return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEAM_SESSION_COOKIE, createSessionToken("team"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
