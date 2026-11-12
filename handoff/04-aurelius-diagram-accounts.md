# Aurelius damage reports, growth-path diagram, account move

## Damage Report
- **Session**: session_011abjnEMnf8QWmRsKJav1K5 — https://claude.ai/code/session_011abjnEMnf8QWmRsKJav1K5
- **Goal**: Train the Slack bot "Aurelius" to pull storm-damage photos from CompanyCam and build a PDF photo report with accurate hail/wind captions, for disputing insurance carrier estimates. Then save those rules as a training guide for the team.
- **Where the work lives**:
  - Slack channel **#approvaldepartment-aurelius** (ID C0C996APF9P): https://proliance-inc.slack.com/archives/C0C996APF9P
  - Slack canvas **"Aurelius Damage Photo Report – Training Guide"**: https://proliance-inc.slack.com/docs/T04SC3AV810/F0C9APWD55X. It was created under Nellie's Slack account and may need sharing before others can open it.
  - Notion page **"Aurelius Damage Photo Report – Training Guide"**, under Welcome to the Approvals Team Workspace → Knowledge Base: https://app.notion.com/p/3f9c5e23903a819ea74de7cde6282a18
    - Workspace root: https://app.notion.com/p/Welcome-to-the-Approvals-Team-Workspace-3d2c5e23903a80fd998bf4da77129e0a
    - Knowledge Base page: https://app.notion.com/p/3d2c5e23903a800397bcc37c65a9e767
  - The Aurelius instructions themselves were only drafted in chat; the user pasted them into Slack by hand. No code was changed.
- **What was done / current state**:
  - Wrote setup and correction messages for Aurelius covering role, photo selection, caption rules, PDF layout, a pre-send checklist and test-run prompts.
  - Claude could not reach CompanyCam: the network proxy blocked app.companycam.com and api.companycam.com, and no CompanyCam connector exists. The user chose to keep improving Aurelius, which already pulls photos from CompanyCam.
  - Changes to the rules, in order:
    - Use the most recent photos.
    - Compare our estimate with the carrier's line by line, and sort items into DENIED, UNDERPAID or AGREED. Pick photos in that priority.
    - Remove the cover/summary page; post the dispute summary in the Slack thread instead. (Later reversed for a branded cover — see the next section.)
    - Short captions: `HAIL IMPACT / WIND DAMAGE – what – where`, 12 words max, "consistent with" wording, no guessing.
    - Layout tried at 4 photos per page, then set to 2 photos per page with a 15-page cap.
    - Red circles (about 3–4 px) on the exact damage, up to 3 per photo. Damage already chalk-marked gets "(chalk-marked)" in the caption instead. Overviews get no circles. Unmarked originals are kept. Marked files are named `_Marked`, then `_Marked_v2`.
    - Drop overview/elevation photos unless they show visible damage or a test square.
    - Review the whole property, not just the roof: windows, gutters, siding, doors, AC, fence and so on. Windows are a partial-payment case: the carrier paid for some windows but not all, so photos of unpaid windows come first.
  - Built the training guide in two places, the Slack canvas and a matching Notion page under Knowledge Base. They are separate copies and do not sync.
  - Last message (the user never confirmed it): captions drop the bracketed line-item tag, which now appears only in the Slack summary; page cap raised to 18 pages (36 photos max); rebuild as `_v3` and show the photo list and summary first.
- **Open items / next steps**:
  - Confirm what "remove the brackets" meant. Claude read it as dropping the line-item tag from captions entirely. The other reading is keeping the line item at the end of the caption without the brackets.
  - Approve Aurelius's photo list and Slack summary before the v3 PDF is built.
  - The canvas and Notion guide are out of date. They don't yet have the whole-property/window rules, captions without brackets, or the 18-page cap.
  - Known limits: photo files don't record slope or elevation, and Aurelius takes hail vs. wind from the carrier's loss type, not from the photo.
  - Undecided: whether the PDF should note that photos are marked, and how to handle AC condensers, fences and interior damage.
  - Claude still can't reach CompanyCam. Fixing that needs a CompanyCam connector, or an API token stored as an environment secret plus the domain allowed in network settings.
- **Key context to carry over**:
  - Golden rule: a person reviews every photo, caption and circle before a report goes to the carrier.
  - Messages to Aurelius:
    - start with `@Aurelius`
    - are formatted as copy-paste code blocks
    - say "starting now"
    - ask Aurelius to post the photo list and captions for approval before building the PDF
  - Captions:
    - say "consistent with," never "caused by"
    - give sizes only when a scale reference is in the photo
    - never call blistering, age wear, nail pops, foot traffic, algae, failed window seals, oxidation or similar hail/wind damage
    - when unsure, use "POSSIBLE HAIL…" and flag the photo
  - Never pad with weak photos. Cut repeated shots first, then AGREED items. Never cut the only photo supporting a DENIED or UNDERPAID item.
  - The Slack summary is grouped by area. For windows it gives: windows we listed, windows the carrier paid, unpaid windows with photos, and unpaid windows without photos.
  - File name: `[Street Address]_[Customer Last Name]_Damage_Report_[YYYY-MM-DD].pdf`, with suffixes `_Marked`, `_Marked_v2`, `_v3`.
- **Prompt to resume**:
```
I'm continuing work on training our Slack bot "Aurelius" (channel #approvaldepartment-aurelius, https://proliance-inc.slack.com/archives/C0C996APF9P) to build storm-damage photo reports (PDF) from CompanyCam for disputing carrier estimates. The current rulebook is the Notion page "Aurelius Damage Photo Report – Training Guide" (https://app.notion.com/p/3f9c5e23903a819ea74de7cde6282a18), and a copy is in a Slack canvas (https://proliance-inc.slack.com/docs/T04SC3AV810/F0C9APWD55X). Please read both first.

Current rules on top of the guide (not yet added to it):
- Review the whole property, not just the roof. Windows were only partly paid, so photos of unpaid windows come first.
- Captions are "HAIL IMPACT / WIND DAMAGE – what – where", 12 words max, with no bracketed line-item tag. Line items go only in the Slack summary, grouped by area.
- 2 photos per page, 18 pages max (36 photos).
- Red circles go on the exact damage. No overviews unless they show damage or a test square.
- A person reviews every report before it goes to the carrier.

Next steps:
1. Help me finalize the v3 instruction (I still need to confirm whether the line item should be dropped from captions entirely).
2. Update the Notion guide and the Slack canvas with these rules and a revision-history entry.
Write any Aurelius messages as copy-paste blocks starting with "@Aurelius". Don't post anything to Slack without my OK.
```

## Slack damage report workflow
- **Session**: session_01Q3tgePp5PGaY2EDAmD8tQ5 — https://claude.ai/code/session_01Q3tgePp5PGaY2EDAmD8tQ5
- **Goal**: Make it easy for the team to request Aurelius damage reports, build a process for evidence and photo gaps (including a Photo Gap Log), set rules on who may change Aurelius's rulebook, and design a branded cover page.
- **Where the work lives**:
  - #approvaldepartment-aurelius. The 1508 Midwest Club job thread: https://proliance-inc.slack.com/archives/C0C996APF9P/p1792004290328499
  - Notion database **"Photo Gap Log"**, under Welcome to the Approvals Team Workspace → Quality & QA: https://app.notion.com/p/4fa5ea0dc4c6401e90ae132d9e668318
    - Quality & QA page: https://app.notion.com/p/3d2c5e23903a80deabb5cc7ee6cea476
    - Holds 7 entries for 1508 Midwest Club Pkwy, Oak Brook, IL.
  - An old Slack List "Photo Gap Log" (https://proliance-inc.slack.com/lists/T04SC3AV810/F0C9EK512AG) was replaced by the Notion database but still exists. Delete it by hand via ⋯ → Delete list.
  - Sample cover-page PDFs exist only as chat attachments and were not saved anywhere permanent. No code was changed.
- **What was done / current state**:
  - Wrote Slack Workflow Builder steps for a "Request Damage Photo Report" form:
    - Fields: address, client name, CompanyCam link, notes.
    - It posts `@Aurelius create damage photo report for {address}…`.
    - Caveat: Aurelius may ignore messages posted by a workflow. Test it first.
  - Drafted an "evidence gaps" standing instruction:
    - Send what can be proven now, and never let gaps delay the report.
    - Gaps go only in the Slack thread, not the PDF.
    - Categories: NO PHOTOS, WEAK EVIDENCE, OLD PHOTOS ONLY.
    - Each gap gives a likely reason and is sorted by dollar value.
    - This effectively drops the 15-photo minimum.
  - Action plan for 1508 Midwest Club:
    1. Approve v3 (18 photos). Caption photos 96, 107 and 190 as "Window sill."
    2. Standing missing-photo instruction with FIX NOW / GET LATER / NO ACTION.
    3. Photo Gap Log plus a monthly report to the PAs.
    4. Fit Aurelius into Audrey and Chazzy's existing photo review; meet with Audrey, Chazzy and Tom.
    5. Update the guide.
    - Flagged that the house may have more than 17 windows, which means our own estimate may be short.
  - The Photo Gap Log started as a Slack List and was rebuilt in Notion.
    - Columns: Item, Job Address, Slack Thread, Area, Gap Type, Carrier Status, Amount at Stake, Likely Reason, Priority, Status, Outcome, PA/Inspector, Inspection Date, Found By, Assigned To, Due Date, Photo Needed, Notes. Gap ID numbers itself (GAP-n); Logged records the date.
    - The window count is Fix now. The other six gaps are Get later: window/door wraps, garage doors, power attic vent, skylight, chimney items, cricket/flashing.
  - Rule-change policy message for Aurelius:
    - The Notion guide is the source of truth.
    - Any specialist can ask for minor or one-report changes.
    - Major rule changes need [@YOUR NAME]'s approval.
    - Aurelius asks for a repeat-back of minor vs. major.
    - Advice: set the Notion page to "Can comment" for the team.
  - Cover page (final choice):
    - Full navy #1F3A5F cover with "DAMAGE PHOTO REPORT", the address on two lines, and the Proliance logo in a white rounded box at top center.
    - Photos start on page 2. Each photo page has a thin navy footer line with the page number.
    - The cover doesn't count toward the 18-page cap.
    - "Powered by Bench" is removed.
- **Open items / next steps**:
  - The final cover-page instruction is drafted but not posted. Replace [@YOUR NAME] with the approver's Slack mention, in it and in the rule-change policy message.
  - Delete the leftover Slack List.
  - Check that Aurelius can write rows to the Notion Photo Gap Log, then add the logging line to its standing instruction.
  - Fill in Amount at Stake and PA/Inspector for the 7 entries.
  - Confirm the real window count at 1508 Midwest Club and decide whether to supplement the estimate.
  - Meet with Audrey, Chazzy and Tom.
  - Set up the monthly PA gap report for the first business day of each month.
  - Update the Notion guide and the canvas with: the missing-photos section, whole-property review, captions without the tag, 18-page cap, cover page, and the rule-change policy.
- **Key context**:
  - Main principle: "submit what we can substantiate now; gaps are for smarter photo collection later, never a bottleneck."
  - Brand: navy #1F3A5F, Proliance logo.
- **Prompt to resume**:
```
I'm continuing the Aurelius damage-photo-report workflow for our approvals team (Slack channel #approvaldepartment-aurelius, https://proliance-inc.slack.com/archives/C0C996APF9P). Please read the Notion training guide (https://app.notion.com/p/3f9c5e23903a819ea74de7cde6282a18) and the Photo Gap Log database under Quality & QA (https://app.notion.com/p/4fa5ea0dc4c6401e90ae132d9e668318).

Decisions already made (not yet in the guide):
- Send what we can prove now. Evidence gaps are flagged only in the Slack thread and logged in the Photo Gap Log, never in the PDF.
- Only I approve major rule changes. Other specialists can request minor or one-report fixes.
- New cover page: full navy #1F3A5F page with the Proliance logo in a white rounded box at top center, "DAMAGE PHOTO REPORT" and the address centered in white. Photos start on page 2, 2 per page, with a thin navy footer line and page number. Max 1 cover + 18 photo pages. Remove "Powered by Bench".

Next steps:
1. Give me the final cover-page instruction for Aurelius with my Slack mention filled in.
2. Update the Notion guide (PDF layout, missing-photos section, rule-change policy, revision history).
3. Help me set up the monthly PA gap report.
Don't post to Slack without my OK.
```

## Graphic flow diagram
- **Session**: session_017yjYAK697BxuV64tnw1Ptu — https://claude.ai/code/session_017yjYAK697BxuV64tnw1Ptu
- **Goal**: Turn the "Approval Department growth Path" Google Doc into a visual flow chart.
- **Where the work lives**:
  - Source Google Doc: https://docs.google.com/document/d/1gZQrWRNDvxC4JkaF3ca-md6_AHlgQ95A5QMlzRGxYMM/edit?tab=t.0
  - Artifact **"Approval Department Growth Path"** (private): https://claude.ai/artifact/Q1AF7ajdLCbjipsQ8N9UUN
- **Current state**: Done. A single HTML page:
  - Two career tracks side by side: Track 1, Approval Specialist (Claim Maximization), and Track 2, Client Experience. Each runs Trainee → Specialist → Senior → Lead → Team Leader → Manager.
  - Each level has a detail card with its purpose, responsibilities and success metrics.
  - Pay where the doc gives it:
    - Trainee: about 2 months, $5 training pay.
    - Specialist: $6–$7, plus .0035 on claims of 100 days or less and .0025 on claims over 100 days.
    - Senior: .0035 on all claims, and .0045 on claims of 60 days or less.
- **Open items**:
  - Gaps in the doc that the chart flags:
    1. Track 1 Level 3 is empty.
    2. Track 1 has two roles labelled Level 4.
    3. No pay is set above Senior in Track 1, or for any Track 2 level.
  - The artifact is private. Share it, or republish it from the new account.
- **Prompt to resume**:
```
Please read our Google Doc "Approval Department growth Path" (https://docs.google.com/document/d/1gZQrWRNDvxC4JkaF3ca-md6_AHlgQ95A5QMlzRGxYMM/edit?tab=t.0) and the existing flow-chart artifact built from it (https://claude.ai/artifact/Q1AF7ajdLCbjipsQ8N9UUN). The chart shows two career tracks (Approval Specialist / Claim Maximization and Client Experience), Trainee → Manager, with each level's purpose, duties, metrics and pay.

Three gaps were flagged earlier:
(1) Track 1 Level 3 is empty.
(2) Track 1 has two "Level 4" roles.
(3) No pay is set above Senior in Track 1 or anywhere in Track 2.

Update the chart with any changes in the doc and keep the gap list current. If you can't edit that artifact, publish a new copy and tell me.
```

## Multi-account isolation in Claude
- **Session**: session_017yjYAKWY43n3Cexs9SL94m — https://claude.ai/code/session_017yjYAKWY43n3Cexs9SL94m
- **Goal**: Work out how each person can connect their own email, Drive and other accounts without mixing data, and what work can move to a new account.
- **Conclusions**:
  - Connectors belong to the Claude login, not to the person typing. Everything done in these sessions was done as the connected accounts on this login.
  - What's needed on the new account:
    1. Its own Claude login, ideally a member seat on the Team/Enterprise org, invited by an Owner or Admin.
    2. Connect your own accounts at https://claude.ai/customize/connectors.
    3. Start a new session afterwards, because connectors load only at session start.
  - **Does NOT transfer:** chat/session history.
  - **Transfers by sharing where the work lives:** the GitHub repo, Notion pages (they belong to the Notion workspace), Google Drive files, claude.ai artifacts (share with edit access), Slack canvases and lists.
  - Watch out for:
    - Org-scoped cloud environments are shared, including any API keys saved on them. Keep personal tokens in a personal environment.
    - Contractors Cloud acts as whoever connected it, so each person connects their own.
- **Prompt to resume**: see the "First session on the new account" prompt in `HANDOFF.md`.
