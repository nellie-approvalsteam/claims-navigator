import { NextRequest, NextResponse } from "next/server";
import { getContentById, updateContent, deleteContent } from "@/lib/content";
import { isAdminRequest } from "@/lib/auth";
import type { ContentType } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TYPES: ContentType[] = ["scenarios", "playbooks", "templates", "carriers", "faq"];

function isValidType(t: string): t is ContentType {
  return (VALID_TYPES as string[]).includes(t);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  if (!isValidType(params.type)) {
    return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  }
  const item = await getContentById<any>(params.type, params.id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  if (!isValidType(params.type)) {
    return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  }
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const updated = await updateContent(params.type, params.id, body);
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  if (!isValidType(params.type)) {
    return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  }
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const ok = await deleteContent(params.type, params.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
