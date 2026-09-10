"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONTENT_FIELDS, CONTENT_LABELS } from "@/lib/adminSchema";
import type { ContentType } from "@/lib/types";
import AdminItemForm from "@/components/AdminItemForm";

const VALID: ContentType[] = ["scenarios", "playbooks", "templates", "carriers", "faq"];

export default function EditItemPage({ params }: { params: { type: string; id: string } }) {
  const type = params.type as ContentType;
  const router = useRouter();
  const [item, setItem] = useState<Record<string, any> | null | undefined>(undefined);

  useEffect(() => {
    if (!VALID.includes(type)) return;
    fetch(`/api/content/${type}/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setItem);
  }, [type, params.id]);

  if (!VALID.includes(type)) return <div className="text-ink/60">Unknown content type.</div>;

  const labels = CONTENT_LABELS[type];

  async function handleSubmit(data: Record<string, any>) {
    const res = await fetch(`/api/content/${type}/${params.id}`, {
      method: "PUT",
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
      <h1 className="mb-5 text-2xl font-bold">Edit {labels.singular}</h1>
      {item === undefined ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : item === null ? (
        <p className="text-sm text-ink/40">Not found.</p>
      ) : (
        <AdminItemForm fields={CONTENT_FIELDS[type]} initial={item} onSubmit={handleSubmit} submitLabel="Save changes" />
      )}
    </div>
  );
}
