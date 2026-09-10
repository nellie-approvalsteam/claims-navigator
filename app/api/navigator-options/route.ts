import { NextResponse } from "next/server";
import { getNavigatorOptions, getCarriers } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const [options, carriers] = await Promise.all([getNavigatorOptions(), getCarriers()]);
  return NextResponse.json({ ...options, carriers });
}
