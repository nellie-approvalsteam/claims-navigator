# Handoff: moving the Approvals projects to a new Claude account

Written 2026-11-12. This covers all 15 Claude Code sessions plus the `claims-navigator` code, so the work can continue on a different Claude account.

**Chat history does not transfer between Claude accounts.** The work itself lives in places you can share: GitHub, Notion, Google Drive, Slack and claude.ai artifacts. Each project file below says where its work lives, what's open, and gives a **ready-to-paste prompt** for starting a new session on the new account.

| File | Projects |
|---|---|
| [01-nb-projects.md](01-nb-projects.md) | NB_Approvals Momentum Board · NB_Claims Navigator · NB_Notion workspace strategy |
| [02-appraisal-analytics.md](02-appraisal-analytics.md) | NB_Appraisal Claims Report (daily automation) · NB_Appraisal vs. supplemented deals profitability · Appraisal vs. supplements analysis · Appraiser history with Mark Stromberger |
| [03-letters-codes-evidence.md](03-letters-codes-evidence.md) | AllState ITEL denial rebuttal · Zero line estimate on denied claims · Building codes CSV/PDF export · Insurance company tools and acceptance |
| [04-aurelius-diagram-accounts.md](04-aurelius-diagram-accounts.md) | Damage Report · Slack damage report workflow · Graphic flow diagram · Multi-account isolation |

---

## 1. Migration checklist (do these in order)

### A. Account and connectors
- [ ] Get your own Claude login. Ideally an Owner or Admin invites you as a member of the org.
- [ ] On the new account, connect **your own** GitHub, Google Drive/Docs/Sheets, Gmail, Slack, Notion and Contractors Cloud at https://claude.ai/customize/connectors.
- [ ] Start a fresh session after connecting; connectors load only when a session starts.

### B. Code (GitHub)
- [ ] Give your GitHub account access to `nellie-approvalsteam/claims-navigator`, or transfer the repo (GitHub → Settings → Transfer ownership).
- [ ] In Claude on the new account, install the Claude GitHub App on that repo.
- [ ] Backup: `claims-navigator-all-branches.bundle` contains every branch. Restore it with:
  ```bash
  git clone claims-navigator-all-branches.bundle claims-navigator
  ```
  ```bash
  cd claims-navigator && git remote set-url origin https://github.com/<you>/claims-navigator.git && git push origin --all
  ```

### C. Things owned by the old Claude account (these do **not** move on their own)
| Item | What to do |
|---|---|
| Scheduled task "Daily appraisal claims report update" (weekdays 7:52 Chicago) | Recreate it on the new account. Prompt in `02-appraisal-analytics.md`. |
| Scheduled task "Approvals Momentum Board hourly refresh" (:20, 7am–7pm Chicago, weekdays) | Recreate it. Prompt in `01-nb-projects.md`. |
| Scheduled task "Commission sheets update" | Not covered by these 15 sessions. Check it on the old account and recreate it. |
| Momentum Board scripts (in the old container's scratchpad, **not in git**) | Download the backup assets from the main board, or have the new session rebuild them. |
| Artifacts: Momentum Board (main + team copy), Appraisal Claims 2026 dashboard, Appraisal vs Supplements report, Stromberger doc, Growth Path chart, Operating Hub Plan | Share each one to the new account with edit access, or republish from the new account. Republished URLs change, so re-send team links. |
| Chat-only drafts: Zero-line-estimate email v3, appraisal-vs-supplements Slack message, `Appraisal_vs_Supplement_Analysis.xlsx`, Aurelius instruction drafts | Copy them out of the old sessions before you lose access. |
| Old sessions' uploaded files (Allstate denial-letter PDF, Illinois Claim Approval Codes spreadsheets) | Download them from the old sessions or find the originals. |

### D. Shared tools (grant the new identity access)
- [ ] **Google Drive**: Editor on the appraisal report folder `1K9AbrMqSkVR86-SuzwEn-hoTzNcrgu1N` and the state folder `1j8IVK2j0GAt9Ql3IylIGzXqJk8m9fibQ`; view access to the Approval Department sheet; access to the "Momentum (Aurelius)" sheet (owned by Aurelius's account).
- [ ] **Notion**: membership in the "Welcome to the Approvals Team Workspace" workspace.
- [ ] **Slack**: #approvaldepartment-aurelius, #approval-department-crew-. Re-share the Aurelius training-guide canvas.
- [ ] **Contractors Cloud**: connect under your own login. It acts as whoever connected it.
- [ ] **Render** (Claims Navigator hosting): add yourself to the Render service so you can manage env vars and deploys.

### E. Security items to handle during the move
- [ ] **Revoke and recreate the Contractors Cloud API token** (`CC_API_TOKEN` in Render). It was visible in a screenshot.
- [ ] Change the weak `TEAM_PASSWORD` in Render.
- [ ] Tell the Contractors Cloud admin that project file URLs download without login.
- [ ] Don't save personal API keys on an org-shared cloud environment.
- [ ] The Momentum Board team copy exposes customer names and addresses to anyone with the link. Keep that link internal.

---

## 2. Code inventory: `nellie-approvalsteam/claims-navigator`

A Next.js 14 + Tailwind app with flat-JSON content (`content/`), a rule-based decision engine, and Claim Lookup (Contractors Cloud + Notion). Live at https://claims-navigator.onrender.com/navigator (Render free plan). See `README.md` for the full architecture, env vars and deploy steps.

**`main`** (6bd488f): v1 app plus Claim Lookup (PR #1, merged).

Unmerged branches, all included in the bundle:

| Branch | What it holds | Status / next step |
|---|---|---|
| `claude/focused-shannon-s5967m` | **PR #2**: Claim overview, which reads the carrier's and our estimate PDFs and labels the claim denied / partial / underpaid / approved (`lib/estimates.ts`) | Open and mergeable. Test, then merge (contest step 1a). |
| `claude/charming-bardeen-ficzd4` | Illinois ITEL "no matching" rebuttal letters (1st and 2nd round), scenario, KB guide, Allstate note | Verify citations, then open a PR. |
| `claude/funny-goldberg-yvu691` | State Farm 10-day pre-appraisal notice playbook content | Review and open a PR. |
| `claude/laughing-cannon-ecdqn5` | Claim notes panel in Claim Lookup (`lib/claimNotes.ts`, `components/ClaimNotes.tsx`) | Review and open a PR. |
| `claude/gracious-galileo-8qflyr` | `appraisal-report/`: daily appraisal-report runbook and Python scripts | **Live dependency.** The scheduled task fetches `ROUTINE.md` from this branch. Don't delete it; consider merging to `main`. |
| `claude/laughing-cannon-ms0yfv` | `analytics/appraiser-scorecard/`: Appraiser Performance workbook, findings, Python CLI | Reference analysis. Merge if you want it kept. |
| `claude/building-codes-export-gfx9v0` | `exports/building-codes/` CSV and PDF of the Illinois Cities DB | Stale (from before the Oct 20 Notion update). Regenerate it. |
| `claude/quirky-tesla-t9na8l` | `call-assistant/docs/ARCHITECTURE.md`: zero-cost Call Assistant proposal | Proposal only. |
| `claude/laughing-heisenberg-27zkap` | `.gitignore` for `.claude/settings.local.json` | Trivial. Merge anytime. |
| `claude/busy-archimedes-24aipb` | This handoff folder | Merge so the handoff is on `main`. |

**Render env vars**: `ADMIN_PASSWORD`, `SESSION_SECRET`, `TEAM_PASSWORD`, `CC_API_TOKEN`, `CC_API_BASE_URL`, `CC_PROJECT_URL_TEMPLATE`, `NOTION_API_KEY`, `NOTION_CITIES_DATABASE_ID`. See `.env.example`. Never commit their values.

---

## 3. Working rules that carry across every project
- **Contractors Cloud is read-only.** Use only private "Scratch –" reports, and delete them afterwards.
- Never edit shared Google Sheets, or rename, move or delete Drive files, unless explicitly asked.
- **No client data in GitHub.**
- Ask before posting to Slack and before changing shared Notion databases. Show a sample before changing anything.
- Never mark building-code facts "Verified" without a building-department or ordinance confirmation.
- Legal citations: **do not cite 50 Ill. Adm. Code 919.80(d)(3)(A)**, which likely doesn't exist. Have counsel verify the case citations. Keep Windridge where the user asked to keep it.
- Develop on a `claude/...` branch; open PRs only when asked; ship features one at a time.

## 4. First session on the new account
```
I've moved to my own Claude account; my earlier sessions were on another account and chat history didn't transfer. Please attach github.com/nellie-approvalsteam/claims-navigator, check out branch claude/busy-archimedes-24aipb (or main, if merged), and read handoff/HANDOFF.md.

Then:
1. List which connectors this session has (GitHub, Google Drive/Sheets/Docs, Gmail, Slack, Notion, Contractors Cloud) and confirm they're signed in as me.
2. Check I can reach the repo, the Notion Approvals Team Workspace, the appraisal report Drive folder and the Momentum (Aurelius) sheet.
3. Go through section 1 of HANDOFF.md and tell me what's still missing.
Don't change anything yet.
```
After that, open a separate session per project using the prompts in files 01–04.
