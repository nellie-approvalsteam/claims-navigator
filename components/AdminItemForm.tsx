"use client";

import { useState } from "react";
import type { FieldDef } from "@/lib/adminSchema";

export default function AdminItemForm({
  fields,
  initial,
  onSubmit,
  submitLabel = "Save",
}: {
  fields: FieldDef[];
  initial: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(key: string, value: any) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(values);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="mb-1.5 block text-sm font-semibold text-ink/80">{f.label}</label>
          {f.kind === "text" && (
            <input
              className="admin-field"
              value={values[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          )}
          {f.kind === "textarea" && (
            <textarea
              className="admin-field"
              rows={f.large ? 10 : 4}
              value={values[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          )}
          {f.kind === "list" && (
            <textarea
              className="admin-field font-mono text-xs"
              rows={5}
              value={Array.isArray(values[f.key]) ? values[f.key].join("\n") : ""}
              onChange={(e) =>
                setField(
                  f.key,
                  e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
          )}
          {f.kind === "steps" && (
            <StepsEditor
              value={Array.isArray(values[f.key]) ? values[f.key] : []}
              onChange={(v) => setField(f.key, v)}
            />
          )}
        </div>
      ))}

      {error && <p className="text-sm text-rust-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
      >
        {saving ? "Saving…" : submitLabel}
      </button>

      <style jsx global>{`
        .admin-field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d6e3de;
          background: white;
          padding: 0.6rem 0.8rem;
          font-size: 0.875rem;
        }
        .admin-field:focus {
          outline: 2px solid #2f5d50;
          outline-offset: 1px;
        }
      `}</style>
    </form>
  );
}

function StepsEditor({
  value,
  onChange,
}: {
  value: { title: string; detail: string }[];
  onChange: (v: { title: string; detail: string }[]) => void;
}) {
  function update(i: number, key: "title" | "detail", val: string) {
    const next = value.slice();
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { title: "", detail: "" }]);
  }

  return (
    <div className="space-y-3">
      {value.map((s, i) => (
        <div key={i} className="rounded-lg border border-teal-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink/50">Step {i + 1}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs font-semibold text-rust-600 hover:underline"
            >
              Remove
            </button>
          </div>
          <input
            className="admin-field mb-2"
            placeholder="Step title"
            value={s.title}
            onChange={(e) => update(i, "title", e.target.value)}
          />
          <textarea
            className="admin-field"
            rows={2}
            placeholder="Detail"
            value={s.detail}
            onChange={(e) => update(i, "detail", e.target.value)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="focus-ring w-full rounded-lg border border-dashed border-teal-300 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
      >
        + Add step
      </button>
    </div>
  );
}
