# Appraisal analytics: claims report automation, profitability, appraisers

> Per the appraisal-report rules, no client data goes to GitHub, so homeowner names are left out of this file. Per-claim details are in the Drive sheets and the dashboard linked below.

## NB_Appraisal Claims Report (daily automation)
- **Session**: session_01QHbpYtypc9pL3vYisvWBEj — https://claude.ai/code/session_01QHbpYtypc9pL3vYisvWBEj. It is still active and a weekday scheduled task fires into it.
- **Goal**: Maintain the "2026 Appraisal Claims" report: every 2026 claim that went to appraisal (originally 382), with carrier estimates, award RCV, appraisal increase, scope and property size, verified against Contractors Cloud documents. A weekday run adds new claims and updates a live dashboard.
- **Where the work lives**:
  - Code and runbook: branch `claude/gracious-galileo-8qflyr`, folder `appraisal-report/`:
    - `ROUTINE.md` (daily runbook) and `INSTRUCTIONS.md` (per-claim extraction rules)
    - `detect_new.py`, `fetch.py`, `build_report.py`, `to_dashboard.py`, `claims_csv.py`
    - `baseline_keys.txt`, `README.md`
  - Scheduled task "Daily appraisal claims report update": weekdays 7:52 America/Chicago. It curls `https://raw.githubusercontent.com/nellie-approvalsteam/claims-navigator/claude/gracious-galileo-8qflyr/appraisal-report/ROUTINE.md` and follows it. **It is tied to the old account and must be recreated on the new one.**
  - Dashboard artifact "Appraisal Claims 2026": https://claude.ai/artifact/HphQBYo8TqFDQUeMCfq1XE
    - Shared with anyone who has the link.
    - Uses the artifact database, collection `claims`: `part-*` docs hold the original 382 claims and must never be touched; per-claim docs override them.
    - Has a fair appraiser ranking (a regression on carrier, roof size, pitch, stories, materials, the carrier's starting position and trades).
    - Light theme on purpose.
  - Google Drive:
    - Report folder: https://drive.google.com/drive/folders/1K9AbrMqSkVR86-SuzwEn-hoTzNcrgu1N
      - base `2026_Appraisal_Claims_Report.xlsx` (file `1915-p4I9ViwV4yfHvUQ6RCtPczi33foe`)
      - one "2026 Appraisal Claims – added <date> (N claims)" sheet per run
    - State folder "_report automation (do not edit)": `1j8IVK2j0GAt9Ql3IylIGzXqJk8m9fibQ`
    - Import sheet "Approvals Data import (do not edit)": `1PcgH_gSnCzRnmTJzD6VWfcS2hpn7bGOmxt_KR4_m6tI`, an IMPORTRANGE mirror of the Approval Department "Data" tab
    - Approval Department source sheet (read only): `1a091eQeN9HdU5uJVcRh927DNuGuELs2mimEii4AjccQ`
- **Current state**:
  - Runs ran normally through Nov 12. Recent runs added 1–4 claims each:
    - 11/2: 3 claims, +$85,082.67
    - 11/6: 2 claims, +$49,397.47
    - 11/10: 4 claims, +$57,106.60
    - 11/12: 1 claim, +$41,733.45
  - On Nov 12 the Drive connector began acting as a different Google account. The report folder had to be shared to that account as Editor, and files from 11/12 on are owned by it.
- **Needs a human check** (see the dated "added" sheets for names):
  - the 11/12 claim: the name in the documents doesn't match the sheet
  - five awards that aren't fully signed (11/3, 11/5, 11/6, 11/10, 11/11 runs)
  - one 11/10 claim at only +$121
  - one 11/10 claim whose carrier is wrong on the Approval sheet (it's Utica National)
  - one 11/6 claim tagged "Standard roofing" whose award was siding only
- **To move this to the new account**:
  1. Give the new account's Google Drive Editor access to the report folder and state folder. The import sheet may need "Allow access" for IMPORTRANGE.
  2. Get edit access to the dashboard artifact, or republish it and migrate its `claims` collection.
  3. Recreate the weekday scheduled task on the new account.
  4. Keep branch `claude/gracious-galileo-8qflyr` alive: the runbook is fetched from it. Better: merge `appraisal-report/` to `main` and point the task there.
  5. The old account also has scheduled tasks "Commission sheets update" and "Approvals Momentum Board hourly refresh". Recreate those too; see `01-nb-projects.md`.
- **Run rules**:
  - Read-only everywhere except creating the two new Drive files per run and writing dashboard rows.
  - No Contractors Cloud writes, no Slack posts, no client data to GitHub.
  - Increase = award RCV minus the carrier's latest pre-appraisal RCV.
  - Use the most fully executed award, and ignore carrier sample "guide" pages.
  - With more than 8 new claims, split them into batches of about 8 and hand each batch to a subagent.
  - Every daily reply ends with a table (Client | Carrier | Award RCV | Increase | Matches sheet | Confidence | Deal type) and a "Worth a human look" list.
- **Prompt to resume**:
```
I'm taking over the "2026 Appraisal Claims" report automation for our Approval Department. The runbook is at https://raw.githubusercontent.com/nellie-approvalsteam/claims-navigator/claude/gracious-galileo-8qflyr/appraisal-report/ROUTINE.md (repo github.com/nellie-approvalsteam/claims-navigator, branch claude/gracious-galileo-8qflyr, folder appraisal-report/). Read ROUTINE.md, INSTRUCTIONS.md and README.md first.

Key IDs:
- Approval Department sheet 1a091eQeN9HdU5uJVcRh927DNuGuELs2mimEii4AjccQ (read-only)
- report folder 1K9AbrMqSkVR86-SuzwEn-hoTzNcrgu1N
- state folder 1j8IVK2j0GAt9Ql3IylIGzXqJk8m9fibQ
- import sheet 1PcgH_gSnCzRnmTJzD6VWfcS2hpn7bGOmxt_KR4_m6tI
- dashboard https://claude.ai/artifact/HphQBYo8TqFDQUeMCfq1XE (collection "claims"; never touch part-* docs)

First check that my Google Drive connector can see the report folder and the state folder, and that I can write to the dashboard. If not, tell me what access I need. Then run today's update following ROUTINE.md exactly, and help me set up a weekday scheduled task (about 7:52am America/Chicago) on this account that runs the same runbook.

Rules: read-only except the two new Drive files per run and dashboard rows; no Contractors Cloud writes, no Slack posts, no client data to GitHub.
```

## NB_Appraisal vs. supplemented deals profitability
- **Session**: session_01VtKAvRTrhuh33hzAUWmZPy — https://claude.ai/code/session_01VtKAvRTrhuh33hzAUWmZPy
- **Goal**: Find out whether appraisal deals do at least as well as fully supplemented deals (Kim, Bobby, Vlad) and as first-time-approved deals, on increase, revenue and profit.
- **Where the work lives**:
  - Findings Doc "Appraisal vs Supplement Analysis – Findings (2026-09-30)": https://docs.google.com/document/d/1t8_lHV9Uwvld6Vy4mmrxh6X-4SodDf1pM8DQPt-gVy0/edit (updated Oct 5)
  - Workbook `Appraisal_vs_Supplement_Analysis.xlsx`: sent as a chat attachment only. The user was asked to put it in Drive folder `1K9AbrMqSkVR86-SuzwEn-hoTzNcrgu1N`. **Check that it's there; if not, download it from the old session.**
  - Inputs:
    - `Supplements_All_Deals.pdf` (Drive `1LrY4OMnn8GfOKBFFiqamKQ-vTl7r53Ty`)
    - `2026_Appraisal_Claims_Report.xlsx`
    - `Appraiser_Performance_Report.xlsx` (Drive `1POJMYITnqaP2erfUVcMvb876Wx3e7dN_`)
    - Contractors Cloud project financials
  - Slack reply in the user's thread in channel C0917L1DE4R: https://proliance-inc.slack.com/archives/C0917L1DE4R/p1791219247784259?thread_ts=1791216828.559369&cid=C0917L1DE4R
- **Results**, in the order Appraisal / Kim only / Bobby-Vlad then Kim / Bobby-Vlad only:
  - Deals: 389 / 179 / 63 / 64; the baseline group has 369.
  - Average initial: $4.6k / $24.1k / $17.9k / $20.1k
  - Average final: $26.9k / $30.2k / $24.8k / $25.9k
  - Average increase per deal: $22.4k / $6.0k / $6.9k / $5.8k
  - Revenue per sold job: $27.5k / $29.6k / $24.3k / $23.0k; baseline $24.8k
  - Gross profit per finished job: $17.1k / $18.8k / $15.8k / $13.1k; baseline $14.5k
  - 47% of appraisal claims started under the deductible.
  - 48 appraisal wins (about $820k awarded) were cancelled after the award.
  - Median time from the carrier's first estimate to the award is 183 days.
- **Verdict**: Settlement and revenue are about the same as supplemented deals. Whether appraisal is equally profitable is **not yet known**:
  - Only 7 appraisal jobs are fully closed: $12.2k profit (49% margin), vs $18.2k (58%) for supplement deals and $15.9k (59%) for the baseline.
  - Appraiser and umpire fees aren't tracked in Contractors Cloud.
  - Revenue = CC "Sold Amount", which is contract value, not cash collected. Payouts are kept separate from expenses, so commission is not double-counted.
- **Next steps**:
  - Track appraiser and umpire fees per job.
  - Re-run the profit comparison in about Q1 2027.
  - Add the CC project ID to the supplements report; 26 deals didn't match by address.
  - Log lost or withdrawn appraisals, not just wins.
- **Prompt to resume**:
```
I'm continuing an analysis comparing appraisal deals vs. supplemented deals (Kim / Bobby / Vlad) vs. naturally approved deals. Findings Doc: https://docs.google.com/document/d/1t8_lHV9Uwvld6Vy4mmrxh6X-4SodDf1pM8DQPt-gVy0/edit (read it first).

Sources:
- Supplements_All_Deals.pdf (Drive 1LrY4OMnn8GfOKBFFiqamKQ-vTl7r53Ty)
- 2026_Appraisal_Claims_Report.xlsx (Drive 1915-p4I9ViwV4yfHvUQ6RCtPczi33foe)
- Contractors Cloud project financials

Current conclusion: settlement and revenue are comparable; profit is not yet known (only 7 appraisal jobs fully closed, and appraiser fees aren't tracked). Revenue = contract value, not cash. Commission is not double-counted.

Please re-run the profit comparison on Closed – Complete jobs only. Use only private scratch reports in Contractors Cloud and delete them afterwards; don't edit other Drive files without asking.
```

## Claims data: appraisal vs. supplements analysis
- **Session**: session_01BSWRmmCqVSoXnQrn1N6DKb — https://claude.ai/code/session_01BSWRmmCqVSoXnQrn1N6DKb
- **Goal**: Compare at least 10 appraisal claims with at least 10 matched supplement-only claims, and recommend when to favor each.
- **Where the work lives**: report artifact "Appraisal vs Supplements", https://claude.ai/artifact/Dab3BV9xqqXQ7Y3GxYrsXL. **It is private: share it with the new account or the team.**
- **Results** (10 appraisal claims vs 14 supplement claims, Chicagoland):
  - Average / median increase: appraisal $20,302 / $20,398; supplement $3,926 / $3,914.
  - Across all 246 supplement claims on file, the median gain is $2,875.
  - By carrier:
    - Allstate appraisals went 5 for 5.
    - State Farm was mixed, with the one loss.
    - State Farm supplements were the strongest of any carrier (+30%).
  - Appraisal fees run about $950–1,500, and the median appraisal takes about 6 months.
- **Recommendation**:
  - Supplement every approved claim first.
  - Escalate to appraisal when the gap after supplements is still over about $8–10k, or when the carrier denied, paid under the deductible, or wrote a repair-only scope.
  - Lean toward appraisal on Allstate and on garage or multi-trade claims.
  - Be careful with State Farm coverage and causation disputes.
  - Treat "in lieu of appraisal" offers as a floor.
- **Open items**:
  - Share the artifact.
  - Post the drafted Slack message; it is in the old chat only.
  - Validate the $8–10k threshold.
- **Data notes**:
  - Supplement figures come from the "Supplements have been completed" jet-stream messages; when there were several rounds, the last one was used.
  - Roof size comes from EagleView XML (TotalRoofArea).
  - Trades come from material-order file names.
  - Contractors Cloud scratch reports were deleted afterwards.
- **Prompt to resume**:
```
I'm continuing an appraisal-vs-supplements comparison. The published report is https://claude.ai/artifact/Dab3BV9xqqXQ7Y3GxYrsXL (10 appraisal claims vs 14 matched supplement-only claims; appraisal avg +$20.3k vs supplements +$3.9k).

Recommendation so far: supplement first, and escalate to appraisal when the post-supplement gap is over $8–10k, or when the carrier denied, paid under the deductible or wrote a repair-only scope.

Next I want to expand the sample and test the $8–10k threshold. Data sources: Contractors Cloud project files (awards, carrier settlement letters, EagleView XML), "Supplements have been completed" jet-stream messages, and the Insurance Company custom field. Only create private scratch reports in Contractors Cloud and delete them when done; don't post to Slack without my approval.
```

## Appraiser history with Mark Stromberger (archived)
- **Session**: session_01YWv8qpX3xPHXyyo1AsA9DG — https://claude.ai/code/session_01YWv8qpX3xPHXyyo1AsA9DG
- **Goal**: Find which of our appraisers faced carrier appraiser Mark Stromberger (MCS Claims) and how they did.
- **Where the work lives**:
  - Claude Doc "Appraisers vs. Mark Stromberger — 2026 Results": https://claude.ai/artifact/3XCGrXkTvK3vYb8Lwi2XDX. It is private.
  - Unsent Slack draft in #approval-department-crew- (C06MT4JHYSH).
- **Results**:
  - 7 claims in 2026, and every award beat the carrier's pre-appraisal RCV: +$40,690 total, no umpire.
  - Mitchell 3/3 (+$20.6k), Jakub 1 (+$13.8k), Zack 2 (+$3.9k; one stayed under the deductible, $0 paid), Jason 1 (+$2.4k).
  - The data doesn't support the July claim that Stromberger is "too tough".
- **Key context**:
  - His name appears in the notes on the carrier's appraisal estimates, not in the Appraiser column.
  - His estimate matched the final award on every claim.
- **Open items**: Share the Doc, then send the Slack draft.
- **Prompt to resume**:
```
Summary of our appraisers vs. carrier appraiser Mark Stromberger (MCS Claims) in 2026:
- 7 claims, all awards above the carrier's pre-appraisal number, +$40,690 total, no umpire
- Mitchell 3/3, Jakub 1, Zack 2 (one under deductible), Jason 1
Source: the Claims tab of 2026_Appraisal_Claims_Report.xlsx (Drive 1915-p4I9ViwV4yfHvUQ6RCtPczi33foe). His name appears in the carrier appraisal-estimate notes, not the Appraiser column.

Please re-check the latest report for new Stromberger claims, recreate the summary doc here, and draft (don't send) a Slack message for #approval-department-crew-.
```
