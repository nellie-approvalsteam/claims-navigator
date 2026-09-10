"use client";

import { useEffect, useState } from "react";
import type { CommTemplate } from "@/lib/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content/templates").then((r) => r.json()).then(setTemplates);
  }, []);

  useEffect(() => {
    if (templates.length === 0) return;
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [templates]);

  async function copy(slug: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(slug);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard API can be unavailable (e.g. non-secure context) — fail quietly
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brass-600">Templates</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Communication Templates</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          Short, natural, professional. Edit directly in the box before copying — nothing you type
          here is saved.
        </p>
      </div>

      <div className="grid gap-4">
        {templates.map((t) => {
          const value = edited[t.slug] ?? t.body;
          return (
            <div
              key={t.slug}
              id={t.slug}
              className="scroll-mt-24 rounded-xl border border-teal-100 bg-white p-4 sm:p-5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink">{t.title}</h3>
                  <p className="text-xs text-ink/50">
                    {t.category} · To: {t.audience}
                  </p>
                </div>
                <button
                  onClick={() => copy(t.slug, value)}
                  className="focus-ring rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  {copied === t.slug ? "Copied!" : "Copy"}
                </button>
              </div>
              <textarea
                className="w-full rounded-lg border border-teal-100 bg-paper-100 p-3 font-mono text-xs leading-relaxed text-ink/85"
                rows={value.split("\n").length + 1}
                value={value}
                onChange={(e) => setEdited((prev) => ({ ...prev, [t.slug]: e.target.value }))}
              />
              {t.tips && <p className="mt-2 text-xs italic text-ink/50">Tip: {t.tips}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
