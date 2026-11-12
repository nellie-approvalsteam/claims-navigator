# NB_ projects: Momentum Board, Claims Navigator, Notion workspace

## NB_Approvals Momentum Board
- **Session**: session_017yjYAHC5yvuqy8DD1QGTm5 — https://claude.ai/code/session_017yjYAHC5yvuqy8DD1QGTm5
- **Goal**: A live hourly dashboard showing, per approval specialist and per weekday, how many assigned claims were Moved forward, Touched but not moved, or Not touched. A sign-in-free copy is kept for the team.
- **Where the work lives**:
  - Main board (Dashboard-type artifact): https://claude.ai/artifact/PiiPyGKuUWN4rvBvhQNsjT
    - Its data is in the artifact DB collection `datasets`, with docs `claim_status`, `moved_log` and `approvals_sheet`. Each doc points at an uploaded JSON blob.
  - Team copy, no sign-in (static page with the data built in, "Anyone with the link"): https://claude.ai/artifact/HVVkz6hngGhrjgC5HprJZe. **Customer names and addresses are visible to anyone with this link.**
  - "Daily Target Sample" preview: https://claude.ai/artifact/2RGAhrtPQqGzgWotR2kP2o
  - Data source: Google Sheet "Nellie's Copy - Estimate/Proposal only", tab **"Momentum (Aurelius)"**: https://docs.google.com/spreadsheets/d/1b7wOqe4gvtinMvTWUmDs05sH_l9VnpEZGoLWmmxF9i8/edit. Aurelius's account owns it.
  - Scheduled task "Approvals Momentum Board hourly refresh": `CRON_TZ=America/Chicago 20 7-19 * * 1-5`. It belongs to the **old account**.
  - Scripts `build_board.py`, `fresh_check.py`, `build_public.py` and the routine prompt lived in the old container's scratchpad. **They are not in git.** Backup copies are stored as assets on the main board: `build_board_aurelius.txt`, `fresh_check`, `build_public_backup.txt`. Download them from the old account while you still can, or have the new session rewrite them from the rules below.
- **Rules**:
  - Status comes only from the Status column of the Aurelius tab, matched by ProjectID. The refresh makes no Contractors Cloud calls.
  - Any Status starting with "Moved forward", including "(scheduled out)" and "(in appraisal)", counts as Moved forward. The text in parentheses is not shown.
  - A claim counts as Moved forward once per week. A Touched claim stays Touched for the rest of the week.
  - Locked days are permanent for the week and reset Monday; new locks go only on today.
  - Unassigned claims are excluded. Weekdays only, America/Chicago.
  - Labels: grey = "Touched but not moved", red = "Not touched".
  - Daily target = assigned claims ÷ 5, rounded up. Cell shading: darkest green ≥100%, middle 80–99%, lightest <80%, white = 0. Cells show the count only, with "N claims · target X/day" under each name.
  - SCHEDULED OUT / IN APPRAISAL note tags:
    - SCHEDULED OUT needs an open task due after today.
    - IN APPRAISAL needs the claim to be at the Perform Appraisal milestone.
    - Either tag makes Aurelius mark the claim Moved forward.
  - Freshness:
    - Aurelius writes the tab at :05. "Last full update" is in K1/L1 (Central) and "Rows written" in K2/L2.
    - The tab is fresh only if L1 is at or after the current hour and the row count equals L2.
    - If not fresh, wait 5 minutes and retry once, then report "Aurelius's latest check wasn't ready".
- **Per-run routine**:
  1. Download the sheet as xlsx.
  2. Run `fresh_check`.
  3. Run `build_board` (sheet, previous moved_log, today) to make 3 JSON files.
  4. Run `build_public` to make the static HTML.
  5. Upload the JSON files as board assets.
  6. Send one ArtifactData batch updating `datasets`.
  7. Republish the team copy.
  8. Delete the old blobs.
  9. Reply with only the two summary lines plus "Claims file last modified: …".
- **Last run** (11-12): 610 sheet rows. Not touched 221, Moved forward 300, Touched 99.
- **Specialists**: Alan, Bern Echiverri, Brandon Mena, Danixa Martinez, Dave Rulona, Felix Espitia, Jimbross Ha, Nellie Balunan, Ralph Sinugbohan.
- **Hard rules**:
  - Read-only on Contractors Cloud ("Make sure to not change anything in contractors cloud!").
  - Never edit the sheet.
  - Any API key goes in the env var `CONTRACTORS_CLOUD_API_KEY`, never in chat.
  - The user wants a sample before changes and clarifying questions first.
- **Open items**:
  - Look at the main board once to confirm the target colours render; only the team copy was visually checked.
  - On the new account:
    - Reconnect Drive to an account with access to the sheet.
    - Republish both boards; the URLs will change, so re-send the team link.
    - Recreate the hourly task.
- **Prompt to resume**:
```
I'm moving my "Approvals Momentum Board" project to this account. Please help me rebuild it and keep it running.

What it is: an hourly dashboard of my approvals team's claim movement. Data comes ONLY from the "Momentum (Aurelius)" tab of the Google Sheet "Nellie's Copy - Estimate/Proposal only" (https://docs.google.com/spreadsheets/d/1b7wOqe4gvtinMvTWUmDs05sH_l9VnpEZGoLWmmxF9i8/edit), matched by ProjectID, using the Status column.

Old boards (old account):
- main https://claude.ai/artifact/PiiPyGKuUWN4rvBvhQNsjT
- team copy https://claude.ai/artifact/HVVkz6hngGhrjgC5HprJZe

Rules:
- Any Status starting with "Moved forward" (incl. "(scheduled out)"/"(in appraisal)") = Moved forward; don't show the parenthetical.
- Moved forward counts once per claim per week. Touched stays Touched for the rest of the week.
- Locked days are permanent for the week (reset Monday); new locks only on today.
- Exclude Unassigned claims. Weekdays only, America/Chicago.
- Labels: "Moved forward", "Touched but not moved" (grey), "Not touched" (red); filter chips All / Moved forward / Touched but not moved / Not touched.
- Week grid: daily target = assigned ÷ 5 rounded up; darkest green ≥100%, middle 80–99%, lightest <80%, 0 = white. Cells show the count only, plus "N claims · target X/day" under each name.
- Freshness: Aurelius writes the tab at :05. Ready only if K1/L1 "Last full update" ≥ the current hour and the data row count = K2/L2 "Rows written"; else wait 5 min, retry once, then report "Aurelius's latest check wasn't ready".
- Refresh weekdays hourly at :20, 7am–7pm Chicago. Reply each run with only the summary lines and "Claims file last modified: …".
- Keep a sign-in-free team copy with the data embedded.

Hard rules: read-only on Contractors Cloud and on Google Sheets/Drive; never put API keys in chat.

Start by checking you can read the sheet, then rebuild the board as an artifact (show me a sample first), then set up the hourly scheduled task.
```

## NB_Claims Navigator
- **Session**: session_014Zi7tiUriTFxCUFiqX6LnQ — https://claude.ai/code/session_014Zi7tiUriTFxCUFiqX6LnQ
- **Goal**: Extend the Claims Navigator web app so specialists without Claude access can look up a claim, see its Contractors Cloud details, get an automatic denied / partial / underpaid overview, and see the city's building codes and relevant Notion resources. This is the user's **company contest entry** (ideas were due about Nov 16).
- **Where the work lives**:
  - Repo https://github.com/nellie-approvalsteam/claims-navigator. Live app: https://claims-navigator.onrender.com/navigator (Render free plan).
  - PR #1, Claim Lookup: **merged**, https://github.com/nellie-approvalsteam/claims-navigator/pull/1
  - PR #2, Claim overview from estimates: **open, mergeable**, https://github.com/nellie-approvalsteam/claims-navigator/pull/2 (branch `claude/focused-shannon-s5967m`)
  - Contest thread: https://proliance-inc.slack.com/archives/C050P7NDNCX/p1793739851215199
  - Render env vars: `TEAM_PASSWORD`, `CC_API_TOKEN`, `CC_API_BASE_URL`, `CC_PROJECT_URL_TEMPLATE`, `NOTION_API_KEY`, `NOTION_CITIES_DATABASE_ID`
- **Current state**:
  - Live lookup confirmed working 11-04.
  - PR #2 reads the newest carrier estimate PDF (or denial letter) and our newest estimate from the project's File Cabinet, then labels the claim:
    - Fully denied: denial letter, or estimate at or below the deductible
    - Partially approved: carrier RCV <50% of ours
    - Underpaid: 50–95%
    - Approved: ≥95%
  - It lists items the carrier left out or allowed for far less, and auto-selects the Navigator status.
  - Tested on a real Allstate claim (CC project 2084001): carrier $3,174.30 RCV = 6% of our $51,649.83, which comes out Partially approved.
- **Contest plan, one step at a time**:
  1. 1a: merge PR #2 and test
  2. 1b: "Was this helpful?" votes saved to a Notion database
  3. 1c: draft carrier notes in GitHub, flagged for senior review
  4. 1d: fix the README hosting section; free Render does not keep admin edits
  5. 1e (optional): AI for "I'm Stuck" via `lib/ai.ts`, which needs a company Anthropic API key
  - Other contest ideas: Carrier & Adjuster Intelligence Cards, Auto Code-Upgrade Packets.
- **Open items**:
  - Merge PR #2 after testing.
  - Confirm `NOTION_API_KEY` is set in Render.
  - Confirm the 50% and 95% cutoffs with the team.
  - **Security**:
    - The Contractors Cloud API token was visible in a screenshot. Revoke it and create a new one.
    - The team passphrase is weak. Change it.
    - Contractors Cloud file URLs download without login. Tell the CC admin.
  - Content gaps:
    - No "Appraisal demand sent" scenario.
    - Carrier name and claim # are on the CC claim record, not the project record.
    - Notion pages are matched by title only.
- **Prompt to resume**:
```
I'm continuing work on my Claims Navigator app (repo https://github.com/nellie-approvalsteam/claims-navigator, live at https://claims-navigator.onrender.com/navigator, Render free plan). Please attach the repo and read handoff/HANDOFF.md first.

State:
- PR #1 (Claim Lookup via Contractors Cloud + Notion building codes/resources) is merged and the live lookup works.
- PR #2 https://github.com/nellie-approvalsteam/claims-navigator/pull/2 (branch claude/focused-shannon-s5967m) adds a "Claim overview". It reads the carrier vs. our estimate PDFs from the File Cabinet and labels the claim Fully denied / Partially approved (<50%) / Underpaid (50–95%) / Approved (≥95%). It is still open.

This is my contest entry. The plan, one step at a time, each tested before the next:
1a. Merge PR #2 and verify on CC project 2084001 (expect Partially approved, 6%).
1b. "Was this helpful?" buttons saving votes to a Notion database.
1c. Draft carrier notes, flagged for senior review.
1d. Fix the README hosting section (free Render doesn't keep admin edits).
1e. Optional: AI for "I'm Stuck" (lib/ai.ts).

Contractors Cloud access must stay read-only. Start by checking PR #2's status and ask me before merging.
```

## NB_Notion workspace strategy
- **Session**: session_01EYNYNCUbK55749LKxTxn5L — https://claude.ai/code/session_01EYNYNCUbK55749LKxTxn5L
- **Goal**: Turn the Approval Department's Notion workspace into an operating hub. This grew into a Building Codes knowledge base, a code-citation guide, and an appraisal-refusal rebuttal template.
- **Where the work lives**:
  - Strategy plan artifact "Approvals Operating Hub Plan": https://claude.ai/artifact/JpdZK2khNX4TfCXRYo7YZF
  - Workspace: https://app.notion.com/p/Welcome-to-the-Approvals-Team-Workspace-3d2c5e23903a80fd998bf4da77129e0a
  - Building Codes, with the Illinois Cities DB: https://app.notion.com/p/3ebc5e23903a81d8a464e1ca23db3737. See also `03-letters-codes-evidence.md`, which covers the later spreadsheet merge.
  - Code Citations by Scenario: https://app.notion.com/p/3ecc5e23903a813580eaf83e450cb082
  - Template "Appraisal Refusal Rebuttal (Using the Carrier's Own Estimate)": https://app.notion.com/p/414c5e23903a813a8ec5cce2cc313ffb
  - Drive folder "Resources for Appraisal Denial": https://drive.google.com/drive/folders/1cILD72UIru0JvlJbLrjJVzZtJoxI73mN
- **Current state**:
  - Strategy plan (9-30):
    - Core recommendation: a **Claim Outcomes Log**, one row per closed claim, recording the first approved amount, the winning route, the denial reason, the appraiser and hours spent.
    - Flagged: the unmeasured "90% success" claim in the client script, appraisal as the biggest cost, and broken links in the Appraisal Playbook.
    - Includes a 90-day roadmap.
  - 60 Illinois cities, chosen from the 500 most recent claims, were researched from web search snippets.
  - Key local rules found:
    - Joliet: full-slope replacement only, no patching.
    - Hickory Hills: exact shingle match or a full reroof (§24.01).
    - Justice: more than 25% of sheathing replaced means 5/8" plywood on the whole roof (Sec. 8-64).
    - Chicago: over 25% of the roof is a reroof (14R-3-306).
    - Lombard: 25-year shingle minimum, permit over 25% of the roof.
  - Code Citations by Scenario: 9 carrier-pushback scenarios. Both Slack FYIs were posted.
  - Rebuttal template (11-10): built from the user's Aragundi email. **Windridge was kept at the user's request.**
- **Open items**:
  - Open the rebuttal template once to confirm the final edit applied: paragraphs separated, Windridge restored.
  - **Legal caution**: Windridge treated matching as a coverage question outside appraisal, so a carrier could quote it back. Xiang Zhao is the backup case.
  - Verify before citing: **50 Ill. Adm. Code 919.80(d)(3)(A)** (another session concluded it likely doesn't exist), and the Runaway Bay citation.
  - Phone or ordinance confirmations: code editions for unknown and conflicting cities, whether the old editions are still in force (Crete 2003, Markham 2006, Lynwood 2012), and ice-barrier requirements.
  - Municode and American Legal were blocked. Retry with network access.
  - The Notion free block limit was hit (grace period ended Oct 3). Check the plan.
  - Not yet built: Claim Outcomes Log, Stalled Claims Watchlist, Appraisal Playbook link fixes, field adjuster scorecard, closed-claim audit, code packet template.
  - Decide whether to keep or delete the private Contractors Cloud report "Scratch – IL claim cities".
- **Preferences**:
  - Never mark a city Verified without confirmation.
  - Keep the user's original wording and citations.
  - Links on Knowledge Base pages are yellow text.
  - Short Slack FYIs with emoji acknowledgments.
  - Use real Contractors Cloud data.
- **Prompt to resume**:
```
I'm continuing work on my Approvals team's Notion workspace ("Welcome to the Approvals Team Workspace": https://app.notion.com/p/Welcome-to-the-Approvals-Team-Workspace-3d2c5e23903a80fd998bf4da77129e0a). Please connect Notion and read these first:
- Building Codes / Illinois Cities: https://app.notion.com/p/3ebc5e23903a81d8a464e1ca23db3737
- Code Citations by Scenario: https://app.notion.com/p/3ecc5e23903a813580eaf83e450cb082
- Template "Appraisal Refusal Rebuttal (Using the Carrier's Own Estimate)": https://app.notion.com/p/414c5e23903a813a8ec5cce2cc313ffb
- Strategy plan: https://claude.ai/artifact/JpdZK2khNX4TfCXRYo7YZF (may need re-sharing from my old account)

Rules: never mark a city Verified without a building-dept or ordinance confirmation. Keep my original citations (keep Windridge in the rebuttal template). Links on Knowledge Base pages are yellow text. Use real Contractors Cloud data, read-only.

First: open the rebuttal template and confirm the email paragraphs are separated and Windridge matches my original. Then help me build the Claim Outcomes Log from the strategy plan, and fill the remaining building-code gaps by reading actual ordinance text on Municode / American Legal.
```
