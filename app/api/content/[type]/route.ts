import { NextRequest, NextResponse } from "next/server";
import { listContent, createContent, newId } from "@/lib/content";
import { isAdminRequest } from "@/lib/auth";
import type { ContentType } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TYPES: ContentType[] = ["scenarios", "playbooks", "templates", "carriers", "faq"];
const ID_PREFIX: Record<ContentType, string> = {
  scenarios: "scn",
  playbooks: "pbk",
  templates: "tpl",
  carriers: "car",
  faq: "kb",
};

function isValidType(t: string): t is ContentType {
  return (VALID_TYPES as string[]).includes(t);
}

export async function GET(_req: NextRequest, { params }: { params: { type: string } }) {
  if (!isValidType(params.type)) {
    return NextResponse.json({ error: "Unknown content type." }, { status: 404 });
  }
  const items = await listContent<any>(params.type);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
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

  const id = newId(ID_PREFIX[params.type]);
  const item = { ...body, id };
  const created = await createContent(params.type, item);
  return NextResponse.json(created, { status: 201 });
}
