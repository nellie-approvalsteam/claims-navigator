"use client";

import { useEffect, useState } from "react";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthed(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Incorrect password.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (authed === null) {
    return <div className="py-20 text-center text-ink/50">Checking access…</div>;
  }

  if (!authed) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-teal-100 bg-white p-6">
        <h1 className="text-lg font-bold text-ink">Admin Access</h1>
        <p className="mt-1 text-sm text-ink/60">
          Enter the shared admin passphrase to add or edit content.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-teal-100 px-3 py-2 text-sm"
            placeholder="Password"
          />
          {error && <p className="text-sm text-rust-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !password}
            className="focus-ring w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
          >
            {submitting ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
