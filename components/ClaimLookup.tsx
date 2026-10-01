"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import type { ClaimSummary } from "@/lib/contractorsCloud";
import type { CityCodes, NotionPageRef } from "@/lib/notion";
import type { SearchIndexEntry } from "@/lib/match";
import type { NavigatorOption } from "@/lib/types";

interface ResourcesResponse {
  claim: ClaimSummary;
  suggestedStatus: string | null;
  notion: {
    status: "ok" | "not-configured" | "error";
    cityCodes: CityCodes | null;
    pages: NotionPageRef[];
  };
  internal: SearchIndexEntry[];
}

const TYPE_LABEL: Record<string, string> = {
  scenario: "Scenario",
  playbook: "Playbook",
  template: "Template",
  faq: "Knowledge Base",
};

export default function ClaimLookup({
  claimStatuses,
  onUseStatus,
}: {
  claimStatuses: NavigatorOption[];
  onUseStatus: (status: string) => void;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClaimSummary[] | null>(null);
  const [selected, setSelected] = useState<ClaimSummary | null>(null);
  const [issue, setIssue] = useState("");
  const [resources, setResources] = useState<ResourcesResponse | null>(null);
  const [loading, setLoading] = useState<"" | "search" | "resources">("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/team-check")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading("search");
    setError("");
    setSelected(null);
    setResources(null);
    try {
      const res = await fetch(`/api/claims/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (res.status === 401) setAuthed(false);
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResults(data.results);
    } catch (err: any) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading("");
    }
  }

  async function findResources(claim: ClaimSummary) {
    setSelected(claim);
    setLoading("resources");
    setError("");
    try {
      const res = await fetch("/api/claims/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: claim.id, issue }),
      });
      const data = await res.json();
      if (res.status === 401) setAuthed(false);
      if (!res.ok) throw new Error(data.error || "Couldn't load resources.");
      setResources(data);
    } catch (err: any) {
      setError(err.message);
      setResources(null);
    } finally {
      setLoading("");
    }
  }

  if (authed === null) return null;

  return (
    <section className="mb-6 rounded-2xl border border-teal-100 bg-white p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">Look up a claim</h2>
        <span className="text-xs text-ink/50">
          Live from Contractors Cloud · nothing is saved
        </span>
      </div>

      {!authed ? (
        <TeamLogin onSuccess={() => setAuthed(true)} />
      ) : (
        <>
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <input
              className="field flex-1"
              placeholder="Client name, address, or project number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={query.trim().length < 2 || loading !== ""}
              className="focus-ring rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
            >
              {loading === "search" ? "Searching…" : "Search"}
            </button>
          </form>

          <label className="mt-3 block text-sm font-semibold text-ink/80">
            What&apos;s the problem? <span className="font-normal text-ink/50">(optional, sharpens the results)</span>
          </label>
          <input
            className="field mt-1.5"
            placeholder='e.g. "carrier denied appraisal", "missing drip edge", "ITEL says discontinued"'
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
          />

          {error && <p className="mt-3 text-sm text-rust-600">{error}</p>}

          {results && !selected && (
            <div className="mt-4 space-y-2">
              {results.length === 0 && (
                <p className="text-sm text-ink/50">No claims match &ldquo;{query}&rdquo;.</p>
              )}
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => findResources(c)}
                  className="focus-ring block w-full rounded-lg border border-teal-100 p-3 text-left text-sm hover:border-teal-600"
                >
                  <ClaimLine claim={c} />
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-teal-600 bg-teal-50 p-3 text-sm">
                <ClaimLine claim={selected} />
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {selected.ccUrl && (
                    <a href={selected.ccUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-800 underline">
                      Open in Contractors Cloud
                    </a>
                  )}
                  <button onClick={() => findResources(selected)} className="font-semibold text-teal-800 underline">
                    Refresh with the problem above
                  </button>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setResources(null);
                    }}
                    className="text-ink/60 underline"
                  >
                    Back to results
                  </button>
                </div>
              </div>

              {loading === "resources" && <p className="text-sm text-ink/50">Finding resources…</p>}

              {resources && loading === "" && (
                <Resources
                  data={resources}
                  statusLabel={claimStatuses.find((s) => s.id === resources.suggestedStatus)?.label}
                  onUseStatus={onUseStatus}
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ClaimLine({ claim }: { claim: ClaimSummary }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-teal-800">{claim.client}</span>
        {claim.number && <span className="text-xs text-ink/50">#{claim.number}</span>}
        {claim.status && <Badge color="gray">{claim.status}</Badge>}
      </div>
      <div className="mt-0.5 text-ink/65">{claim.address}</div>
      <div className="mt-0.5 text-xs text-ink/50">
        {claim.milestone && <>Milestone: {claim.milestone}</>}
        {claim.milestone && claim.rep && " · "}
        {claim.rep && <>Rep: {claim.rep}</>}
      </div>
    </>
  );
}

function Resources({
  data,
  statusLabel,
  onUseStatus,
}: {
  data: ResourcesResponse;
  statusLabel?: string;
  onUseStatus: (status: string) => void;
}) {
  const { notion, internal, claim, suggestedStatus } = data;
  const codes = notion.cityCodes;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={`Building codes · ${claim.city ?? "unknown city"}`}>
        {notion.status === "not-configured" && <Muted>Notion isn&apos;t connected yet — ask an admin to set NOTION_API_KEY.</Muted>}
        {notion.status === "error" && <Muted>Couldn&apos;t reach Notion right now. Try again shortly.</Muted>}
        {notion.status === "ok" && !codes && (
          <Muted>
            {claim.city ?? "This city"} isn&apos;t in the Building Codes list yet. If the address is
            unincorporated, it follows the county code.
          </Muted>
        )}
        {codes && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{codes.codeEdition ?? "Edition unknown"}</span>
              {codes.researchStatus && (
                <Badge color={codes.researchStatus === "Verified" ? "teal" : "brass"}>
                  {codes.researchStatus}
                </Badge>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <CodeRow label="Ice & water shield" value={codes.iceAndWater} />
              <CodeRow label="Drip edge" value={codes.dripEdge} />
              <CodeRow label="Max roof layers" value={codes.maxRoofLayers} />
              <CodeRow label="Reroof permit" value={codes.reroofPermit} />
            </dl>
            {codes.otherItems.length > 0 && (
              <p className="text-xs text-ink/70">Also check: {codes.otherItems.join(", ")}</p>
            )}
            {codes.notes && <p className="text-xs italic text-ink/70">{codes.notes}</p>}
            {codes.researchStatus !== "Verified" && (
              <p className="text-xs text-rust-600">Not verified — confirm with the building department before citing.</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs">
              <a href={codes.url} target="_blank" rel="noreferrer" className="font-semibold text-teal-800 underline">Open city page</a>
              {codes.codeSource && <a href={codes.codeSource} target="_blank" rel="noreferrer" className="text-teal-800 underline">Code source</a>}
              {codes.deptWebsite && <a href={codes.deptWebsite} target="_blank" rel="noreferrer" className="text-teal-800 underline">Building dept</a>}
              {codes.deptPhone && <span className="text-ink/60">{codes.deptPhone}</span>}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="From the team's Notion">
        {notion.status === "ok" && notion.pages.length === 0 && (
          <Muted>No matching pages. Describe the problem above for better matches.</Muted>
        )}
        {notion.status !== "ok" && <Muted>Unavailable — see the building codes panel.</Muted>}
        <ul className="space-y-1.5">
          {notion.pages.map((p) => (
            <li key={p.id}>
              <a href={p.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-teal-800 hover:underline">
                {p.title} ↗
              </a>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Scenarios, playbooks & templates" className="md:col-span-2">
        {suggestedStatus && statusLabel && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink/70">
              Based on its milestone, this claim looks like <strong>{statusLabel}</strong>.
            </span>
            <button
              onClick={() => onUseStatus(suggestedStatus)}
              className="focus-ring rounded-md border border-teal-600 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50"
            >
              Use this in the Navigator below
            </button>
          </div>
        )}
        {internal.length === 0 ? (
          <Muted>Nothing matched yet — add a short description of the problem above.</Muted>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {internal.map((r) => (
              <li key={`${r.type}-${r.slug}`}>
                <Link href={r.url} className="focus-ring block h-full rounded-lg border border-teal-100 p-3 text-sm hover:border-teal-600">
                  <span className="text-xs text-ink/45">{TYPE_LABEL[r.type]}</span>
                  <span className="block font-semibold text-ink">{r.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-ink/60">{r.snippet}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-teal-100 p-4 ${className}`}>
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">{title}</div>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink/50">{children}</p>;
}

function CodeRow({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-ink/55">{label}</dt>
      <dd className={value === "Required" ? "font-semibold text-teal-800" : "text-ink/80"}>{value ?? "—"}</dd>
    </>
  );
}

function TeamLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/team-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) onSuccess();
      else setError((await res.json().catch(() => ({}))).error || "Incorrect passphrase.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm text-ink/65">
        Claim lookup shows client information, so it needs the team passphrase (once every 12 hours).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          className="field flex-1"
          placeholder="Team passphrase"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting || !password}
          className="focus-ring rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Unlock"}
        </button>
      </div>
      {error && <p className="text-sm text-rust-600">{error}</p>}
    </form>
  );
}
