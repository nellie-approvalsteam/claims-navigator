"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONTENT_LABELS } from "@/lib/adminSchema";
import type { ContentType } from "@/lib/types";

const VALID: ContentType[] = ["scenarios", "playbooks", "templates", "carriers", "faq"];

function labelFor(item: any): string {
  return item.name || item.title || item.slug || item.id;
}
function subLabelFor(item: any): string {
  return item.category || item.audience || "";
}

export default function AdminListPage({ params }: { params: { type: string } }) {
  const type = params.type as ContentType;
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!VALID.includes(type)) return;
    load();
  }, [type]);

  function load() {
    setLoading(true);
    fetch(`/api/content/${type}`)
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
    const res = await fetch(`/api/content/${type}/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert("Could not delete — please try again.");
  }

  if (!VALID.includes(type)) {
    return <div className="text-ink/60">Unknown content type.</div>;
  }

  const labels = CONTENT_LABELS[type];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{labels.plural}</h1>
          <p className="text-sm text-ink/60">{items.length} items</p>
        </div>
        <Link
          href={`/admin/${type}/new`}
          className="focus-ring rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          + Add {labels.singular}
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/40">Nothing here yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-teal-100 bg-white">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-teal-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{labelFor(item)}</div>
                    {subLabelFor(item) && (
                      <div className="text-xs text-ink/45">{subLabelFor(item)}</div>
                    )}
                  </td>
                  <td className="w-40 px-4 py-3 text-right">
                    <button
                      onClick={() => router.push(`/admin/${type}/${item.id}`)}
                      className="focus-ring mr-2 rounded-md border border-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:border-teal-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, labelFor(item))}
                      className="focus-ring rounded-md border border-teal-100 px-3 py-1.5 text-xs font-semibold text-rust-600 hover:border-rust-500"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
