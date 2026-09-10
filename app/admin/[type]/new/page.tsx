"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONTENT_FIELDS, CONTENT_LABELS, emptyItem } from "@/lib/adminSchema";
import type { ContentType } from "@/lib/types";
import AdminItemForm from "@/components/AdminItemForm";

const VALID: ContentType[] = ["scenarios", "playbooks", "templates", "carriers", "faq"];

export default function NewItemPage({ params }: { params: { type: string } }) {
  const type = params.type as ContentType;
  const router = useRouter();

  if (!VALID.includes(type)) return <div className="text-ink/60">Unknown content type.</div>;

  const labels = CONTENT_LABELS[type];

  async function handleSubmit(data: Record<string, any>) {
    const res = await fetch(`/api/content/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Could not save.");
    }
    router.push(`/admin/${type}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/admin/${type}`} className="mb-4 inline-block text-sm text-teal-700 hover:underline">
        ← {labels.plural}
      </Link>
      <h1 className="mb-5 text-2xl font-bold">Add {labels.singular}</h1>
      <AdminItemForm fields={CONTENT_FIELDS[type]} initial={emptyItem(type)} onSubmit={handleSubmit} submitLabel="Create" />
    </div>
  );
}
