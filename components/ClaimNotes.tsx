"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/Badge";
import type { ClaimNote } from "@/lib/contractorsCloud";
import { NOTE_FLAGS, type NotesBrief } from "@/lib/claimNotes";

const RECENT_COUNT = 8;
const FLAG_LABEL = Object.fromEntries(NOTE_FLAGS.map((f) => [f.key, f.label]));
const HIGHLIGHT = new RegExp(NOTE_FLAGS.map((f) => f.pattern.source).join("|"), "gi");

export default function ClaimNotes({ projectId, onUnauthorized }: { projectId: number; onUnauthorized: () => void }) {
  const [brief, setBrief] = useState<NotesBrief | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBrief(null);
    setError("");
    setShowAll(false);
    fetch(`/api/claims/notes?projectId=${projectId}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401) onUnauthorized();
        if (!res.ok) throw new Error(data.error || "Couldn't load notes.");
        if (!cancelled) setBrief(data);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, onUnauthorized]);

  return (
    <div className="rounded-xl border border-teal-100 p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-widest text-ink/50">Claim notes</div>
        {brief && (
          <span className="text-xs text-ink/50">
            {brief.userNotes.length} team note{brief.userNotes.length === 1 ? "" : "s"}
            {brief.lastUserNoteAt && <> · last {formatDate(brief.lastUserNoteAt)}</>}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-rust-600">{error}</p>}
      {!brief && !error && <p className="text-sm text-ink/50">Loading notes…</p>}

      {brief && (
        <div className="space-y-4">
          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">
              Flagged notes{" "}
              <span className="font-normal text-ink/50">
                deadlines, denials, appraisal, legal, payment, client concerns
              </span>
            </h3>
            {brief.flagged.length === 0 ? (
              <p className="text-sm text-ink/50">Nothing in the team notes matched a flag.</p>
            ) : (
              <ul className="space-y-2">
                {brief.flagged.map(({ note, flags }) => (
                  <li key={note.id} className="rounded-lg border border-rust-500/30 bg-rust-500/5 p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      {flags.map((f) => (
                        <Badge key={f} color="rust">
                          {FLAG_LABEL[f]}
                        </Badge>
                      ))}
                      <NoteMeta note={note} />
                    </div>
                    <NoteBody text={note.body} highlight />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">Team notes, newest first</h3>
            {brief.userNotes.length === 0 ? (
              <p className="text-sm text-ink/50">No one has typed a note on this claim yet.</p>
            ) : (
              <>
                <ul className="divide-y divide-teal-100">
                  {(showAll ? brief.userNotes : brief.userNotes.slice(0, RECENT_COUNT)).map((note) => (
                    <li key={note.id} className="py-2 text-sm">
                      <NoteMeta note={note} />
                      <NoteBody text={note.body} />
                    </li>
                  ))}
                </ul>
                {brief.userNotes.length > RECENT_COUNT && (
                  <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-semibold text-teal-800 underline">
                    {showAll ? "Show fewer" : `Show all ${brief.userNotes.length} team notes`}
                  </button>
                )}
              </>
            )}
          </section>

          {brief.systemNotes.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-ink/70">
                System activity ({brief.systemNotes.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-ink/65">
                {brief.systemNotes.map((note) => (
                  <li key={note.id}>
                    <span className="text-ink/45">{formatDate(note.createdAt)}</span> — {note.body}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {brief.truncated && (
            <p className="text-xs text-ink/50">
              Showing the most recent notes only. Open the claim in Contractors Cloud for the full history.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NoteMeta({ note }: { note: ClaimNote }) {
  return (
    <span className="text-xs text-ink/50">
      {formatDate(note.createdAt)}
      {note.author && <> · {note.author}</>}
      {note.type && <> · {note.type}</>}
    </span>
  );
}

function NoteBody({ text, highlight = false }: { text: string; highlight?: boolean }) {
  if (!highlight) return <p className="whitespace-pre-line text-ink/80">{text}</p>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of Array.from(text.matchAll(HIGHLIGHT))) {
    const start = m.index ?? 0;
    parts.push(text.slice(last, start), <mark key={start} className="rounded bg-brass-400/30 px-0.5 text-ink">{m[0]}</mark>);
    last = start + m[0].length;
  }
  parts.push(text.slice(last));
  return <p className="whitespace-pre-line text-ink/80">{parts}</p>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
