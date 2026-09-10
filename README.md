# Claims Navigator

A standalone decision-support tool for the Insurance Claims Approval Department. Built to answer
one question fast: *"I have a claim problem — what are my options, and what should I do next?"*

This is **not** tied to any personal account (Claude, ChatGPT, or otherwise), any personal API key,
or any one person's computer. It's a normal web application that your team deploys once, to your
own hosting, under a shared URL everyone on the team can use.

---

## A. Architecture

Claims Navigator is a single Next.js application with three layers:

1. **Content** — plain JSON files in `/content` (scenarios, playbooks, templates, carriers,
   knowledge-base articles, and the decision-rules weight table). This is the department's
   institutional knowledge, stored as data, not code.
2. **Application logic** — a small set of page routes (the dashboard, Claim Navigator, "I'm Stuck",
   Next Step, Scenario Library, Playbooks, Templates, Knowledge Base, Search) plus a rule-based
   recommendation engine (`lib/decisionEngine.ts`) that scores the five possible paths (Reinspection,
   Push the Estimate, Appraisal, Documentation, Escalation) against whatever the specialist enters,
   and a matching engine (`lib/match.ts`, using Fuse.js) that powers Search and "I'm Stuck" free-text
   matching.
3. **Admin API** — a set of API routes (`/api/content/[type]`, `/api/rules`) that read and write the
   JSON content files directly, gated behind a shared admin passphrase. This is what lets a
   non-developer add or edit a scenario, playbook, template, carrier, or knowledge-base article
   through a web form — no code change, no redeploy.

Nothing in this app calls an AI model. The recommendation engine is deterministic and rule-based
(weighted scoring over tags you select), and "I'm Stuck" uses fuzzy keyword matching against the
Scenario Library. That keeps the tool fast, explainable, free to run, and dependency-free — see
Section 22 (Future-Ready Design) below for how to add a real AI layer later without restructuring
anything.

## B. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14** (App Router, TypeScript) | One codebase for pages + API routes; easy to deploy anywhere that runs Node. |
| Styling | **Tailwind CSS** | Fast to build and keep visually consistent; no design system to hand-maintain. |
| Content storage | **Flat JSON files** on disk (`/content`) | Human-readable, git-diffable, editable by hand *or* through the admin UI. No database to provision, back up, or pay for in v1. |
| Search | **Fuse.js** (client + server) | Lightweight fuzzy search, no external search service needed at this data volume. |
| Admin auth | **Shared passphrase + signed cookie** | Zero user-account management for v1. Upgrade path to real SSO is isolated to `lib/auth.ts`. |
| Hosting | **Railway or Render** (recommended) | Both run a persistent Node process with a writable filesystem, which the JSON-file content store needs. See Section F. |

**Why not a database in v1?** The content volume is small (dozens of records per type) and the
team's real need is *"a non-developer can update this without calling anyone."* Flat JSON files
edited through a simple admin UI satisfy that directly, and are trivial to inspect, back up (they're
just files — copy them, or let git track them), or migrate later. If/when the team wants live
multi-editor collaboration, audit trails beyond the built-in changelog, or the content volume grows
much larger, `lib/content.ts` is the *only* file that would need to change to swap in a real
database — every page and API route calls through it rather than touching files directly.

**Why not Vercel?** Vercel's serverless functions don't have a writable, persistent filesystem
across requests, so admin edits wouldn't stick. Railway and Render both run your app as a normal
long-lived Node process with a persistent disk, which is what this content store needs. (You *can*
deploy read-only content to Vercel if you swap the content store for a database — see above.)

## C. Data Structure

Each content type is a JSON array of objects in `/content`. Field shapes are defined in
`lib/types.ts` and enforced (loosely) by the admin form schema in `lib/adminSchema.ts`.

- **`scenarios.json`** — the Scenario Library. Each entry: name, category, status/problem tags (used
  to match it from the Claim Navigator and "I'm Stuck"), what happened, what to check, possible
  solutions, recommended first move, supporting documentation, what to say/write, related template
  slugs, follow-up, if-unsuccessful, escalation point.
- **`playbooks.json`** — standardized workflows. Each entry: name, summary, when to use, what to
  check, an ordered list of steps (title + detail), related template slugs, follow-up, escalation.
- **`templates.json`** — communication templates with `{{placeholder}}` fill-ins, a category, and an
  audience (Client / Adjuster / Appraiser / Internal).
- **`carriers.json`** — carrier list with a free-text notes field, editable by admins as the team
  learns each carrier's patterns. Starts empty/generic on purpose — see the note in Section 15.
- **`faq.json`** — Knowledge Base articles: title, category, description, when to use, content,
  related scenario slugs.
- **`decisionRules.json`** — the single most important file for how recommendations behave: the five
  options, a weight table mapping each "current problem" tag and each claim status to a 0-3 score
  per option, and the Recommended Next Step narrative template for each option. This is what
  `/admin/rules` edits.
- **`navigatorOptions.json`** — the dropdown/checkbox option lists (claim statuses, damage types,
  problem tags) shown in the Claim Navigator.
- **`changelog.json`** — an append-only log of every admin create/update/delete, shown at
  `/admin/changelog`. This is the seed of the "version history" feature described in Section 22.

## D. User Flow (Approval Specialist)

1. Open the tool → land on the **Dashboard** with six large, obvious entry points.
2. Pick the one that matches what they need right now:
   - **Claim Navigator** — answer a short questionnaire (claim status, carrier, damage type,
     current problem(s)) → get "what's likely happening," ranked options, and one clearly
     recommended next step with what to do, why, what to gather, who to contact, and what to do if
     it fails.
   - **I'm Stuck** — describe the situation in plain language → get matched to the closest Scenario
     Library entry, shown in the WHAT I SEE / POSSIBLE ANGLES / BEST NEXT MOVE / WHAT TO GATHER /
     WHO TO CONTACT / IF THAT DOESN'T WORK / DOCUMENTATION format.
   - **Next Step** — already know the path (e.g. "I'm doing appraisal") → jump straight to that
     path's full next-step breakdown.
   - **Playbooks** — browse the standardized step-by-step workflows.
   - **Knowledge Base** — look up a definition, carrier note, or reference fact.
   - **Search** — one box across everything.
3. Every result page links back into the Scenario Library, Playbooks, and Templates, so a specialist
   can go from "what's happening" to "here's the exact email to send" in a couple of clicks.

Nothing in the Claim Navigator or "I'm Stuck" is saved by default — see Section 15 (Data Privacy)
below. This is deliberately a decision-support tool, not a claim record system.

## E. Admin Workflow

1. Go to `/admin` and enter the shared passphrase (`ADMIN_PASSWORD`).
2. From the Admin Dashboard, pick a content type (Scenarios, Playbooks, Templates, Carriers,
   Knowledge Base) to see a list with **Add / Edit / Delete**.
3. Edit forms are plain fields — text, multi-line text, and "one per line" lists for array fields
   (like "What to Check" or "Possible Solutions"). Playbook steps get a small repeatable
   title/detail editor.
4. Saving writes directly to the corresponding JSON file. **Changes are live immediately** — no
   redeploy, no code, no waiting on IT.
5. `/admin/rules` is where the Claim Navigator's brain lives: a weight table per "current problem"
   tag and per claim status (0-3, per option), plus an "Advanced (JSON)" tab for editing the full
   rules file — including the Recommended Next Step narrative text for each of the five paths —
   directly.
6. `/admin/changelog` shows every change made through the admin area, in case something needs to be
   traced back or reverted by hand.

No developer involvement is required for any of this after the initial deployment.

## F. Deployment Plan (making this a standalone, team-accessible tool)

This app has zero dependency on any personal account — no Claude account, no ChatGPT account, no
personal API key, and it doesn't call an AI provider at all in v1 (see Section 22). Anyone on the
team with repo access can deploy it.

**Recommended path — Railway or Render (both free-tier friendly, both give you a persistent
filesystem so admin edits stick):**

1. Push this project to a **GitHub repository owned by the company/team** (not a personal account).
2. Create a new project on [Railway](https://railway.app) or [Render](https://render.com) and
   connect that GitHub repo.
3. Set the build command to `npm install && npm run build` and the start command to `npm start`.
4. Set environment variables in the hosting platform's dashboard (never in code, never committed to
   git):
   - `ADMIN_PASSWORD` — the shared admin passphrase.
   - `SESSION_SECRET` — a random string (e.g. `openssl rand -hex 32`).
5. Deploy. You'll get a shared URL (e.g. `claims-navigator-production.up.railway.app`) — this is what
   the whole team uses. Both platforms support attaching a custom domain later
   (e.g. `claims.yourcompany.com`) if you want one.
6. Share the URL with the team. That's it — there's no "my account" involved anywhere in this
   chain.

**Before you go live — check `npm audit`:** this app is pinned to Next.js 14.2.35 (the latest
patched release on the 14.x line). Running `npm audit` will still show advisories, because npm
flags the whole 14.x line for a handful of CVEs that were only fixed in the 15.x/16.x majors — most
of which involve features this app doesn't use (`next/image` optimization, Middleware, i18n
rewrites). It's still worth having someone review `npm audit`'s output before this is exposed
outside your team's network, and treating an eventual upgrade to Next 15 as planned maintenance
rather than something to defer indefinitely — App Router, the pages, and the API routes here will
carry over with modest changes.

**Team authentication, later:** v1 uses one shared passphrase for the admin area only (viewing the
tool itself requires no login at all, by design, so any specialist can use it instantly). If the
team later wants individual logins or to gate the *whole* tool behind company SSO (Google
Workspace, Microsoft Entra, Okta, etc.), the clean upgrade path is to swap `lib/auth.ts` for
[NextAuth.js](https://next-auth.js.org) or a similar library configured against your identity
provider — every route already checks auth through the functions in that one file, so this doesn't
touch the rest of the app.

**Running it locally** (for development or to try it before deploying):

```bash
npm install
cp .env.example .env.local   # then edit ADMIN_PASSWORD and SESSION_SECRET
npm run dev
```

Open http://localhost:3000.

---

## 15. Data Privacy / Claim Information

By design, the Claim Navigator and "I'm Stuck" inputs are **not saved anywhere** — they exist only
in the browser's memory for that session and are sent to the server just long enough to compute a
recommendation. No claim number or client name field exists in either flow. The UI says this
directly so specialists don't feel like they need to sanitize their inputs.

Content that *is* stored (scenarios, playbooks, templates, carriers, knowledge base) is
institutional knowledge, not claim data — it's meant to be edited by admins, not populated with
individual client information. Carrier notes start empty/generic in this build; add carrier-specific
patterns only as the team confirms them, and avoid putting client-identifying detail into a
scenario or knowledge-base entry.

## 17. Safety / Decision Language

The recommendation engine and every piece of seeded content use hedged, non-committal language on
purpose ("consider," "a possible next step is," "check whether," "escalate if") and explicitly
avoids guarantee language ("this will definitely get approved," "the carrier has to pay"). A short
disclaimer appears on every recommendation screen. If you add new scenarios or templates through the
admin area, keep this pattern — the tool suggests strategy, it doesn't promise outcomes.

## 22. Future-Ready Design

This v1 is intentionally scoped, but every extension named in the original spec has a clear landing
spot already built in:

- **AI-powered analysis** — `lib/ai.ts` is a ready stub. Wire in a real provider (OpenAI,
  Anthropic, etc.) there, reading the key from `AI_API_KEY` (server-side only, never shipped to the
  browser), and call it from `/api/stuck` alongside (or instead of) the keyword match — the rest of
  the app doesn't need to change.
- **Claim history / analytics / user roles** — would live behind the same `lib/content.ts`
  abstraction; swapping flat files for a real database (Postgres via Prisma is a natural choice) is
  the one change needed, since no page or route touches the filesystem directly.
- **Version history for content** — `changelog.json` / `/admin/changelog` already records every
  change; extending it to store full before/after snapshots (not just the "what changed" line) is a
  small addition to `lib/content.ts`.
- **Feedback ("was this helpful?") / flag outdated info** — straightforward additions: a small POST
  endpoint that appends to a `feedback.json` file, and a button on `NextStepCard` / scenario pages.
- **Document/photo upload, estimate extraction, Contractors Cloud integration** — all additive: new
  API routes and, for anything AI-driven, calls through the same `lib/ai.ts` seam.

None of these are built in v1 on purpose — the brief was not to overbuild the first version.

---

## What's included in v1

- Dashboard with all six entry points
- Claim Navigator (guided questionnaire → likely situation, ranked options, recommended next step)
- "I'm Stuck" free-text scenario matching
- Next Step quick-picker
- Scenario Library — **22 scenarios**
- Playbooks — **7 playbooks** (Reinspection, Appraisal, Denial, Underpayment, Documentation, Client
  Follow-Up, Carrier Follow-Up)
- Communication Templates — **10 templates**
- Knowledge Base — 10 reference articles + a carrier list (13 carriers, ready for notes)
- Global search across everything
- Full Admin/Edit area for every content type, plus a Decision Rules weight editor and changelog
- No AI dependency, no personal API key, no dependency on any individual's account

## Project structure

```
content/            JSON content — the department's knowledge, edited via /admin or by hand
lib/                 Content store, auth, recommendation engine, search/matching, types
components/          Shared UI components
app/                 Next.js pages and API routes
  (public pages)     /, /navigator, /stuck, /next-step, /scenarios, /playbooks, /templates,
                      /knowledge-base, /search
  /admin             Password-gated admin area (list/add/edit/delete per content type, rules editor)
  /api               Route handlers backing all of the above
```
