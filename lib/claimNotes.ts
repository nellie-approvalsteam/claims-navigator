import type { ClaimNote } from "./contractorsCloud";

// Phrases in a claim note that a specialist picking the claim up should never
// miss. A note matching any of these is shown word-for-word under "Flagged
// notes", whatever else the brief shows. Keep patterns specific: a flag that
// fires on every note is as useless as no flag.
export const NOTE_FLAGS: { key: string; label: string; pattern: RegExp }[] = [
  {
    key: "deadline",
    label: "Deadline",
    pattern: /\b(deadline|due (by|on|date)|expir(es|ed|ation)|statute of limitations|within \d+ days|no later than)\b/i,
  },
  {
    key: "denial",
    label: "Denial",
    pattern: /\b(denied|denial|denying|declined|rejected|not covered|no coverage|closed without payment)\b/i,
  },
  { key: "appraisal", label: "Appraisal", pattern: /\b(appraisal|appraiser|umpire)\b/i },
  {
    key: "legal",
    label: "Legal / DOI",
    pattern: /\b(attorney|lawyer|lawsuit|litigation|bad faith|DOI|department of insurance|public adjuster|subpoena)\b/i,
  },
  { key: "reinspection", label: "Reinspection", pattern: /\b(re-?inspect(ion|ed)?)\b/i },
  {
    key: "money",
    label: "Payment",
    pattern: /\b(supplement(al)?|recoverable depreciation|check (received|sent|issued)|mortgage company|endorse(d|ment)?)\b/i,
  },
  {
    key: "client",
    label: "Client concern",
    pattern: /\b(upset|angry|frustrated|complain(t|ed|ing)?|threaten(ed|ing)?|wants to cancel|cancel(l)?ation)\b/i,
  },
];

export interface FlaggedNote {
  note: ClaimNote;
  flags: string[];
}

export interface NotesBrief {
  userNotes: ClaimNote[];
  systemNotes: ClaimNote[];
  flagged: FlaggedNote[];
  lastUserNoteAt: string | null;
  truncated: boolean;
}

export function noteFlags(body: string): string[] {
  return NOTE_FLAGS.filter((f) => f.pattern.test(body)).map((f) => f.key);
}

// Splits the log into what people wrote and what the system recorded, and
// pulls out every note that trips a flag. Only user notes are flagged: system
// entries like "Status changed to Appraisal" would otherwise flood the list.
export function buildNotesBrief(notes: ClaimNote[], truncated: boolean): NotesBrief {
  const userNotes = notes.filter((n) => n.source === "user");
  const systemNotes = notes.filter((n) => n.source === "system");
  const flagged = userNotes
    .map((note) => ({ note, flags: noteFlags(note.body) }))
    .filter((f) => f.flags.length > 0);
  return {
    userNotes,
    systemNotes,
    flagged,
    lastUserNoteAt: userNotes[0]?.createdAt ?? null,
    truncated,
  };
}
