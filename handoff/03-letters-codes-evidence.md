# Denial rebuttals, building codes, carrier evidence

> Claim numbers and homeowner names are left out of this repo. Get them from the original denial letter or from Contractors Cloud.

## AllState ITEL denial rebuttal
- **Session**: session_017yjYAHBJ78WiKcoS9LU4ve — https://claude.ai/code/session_017yjYAHBJ78WiKcoS9LU4ve
- **Goal**: Write a strong rebuttal for when Allstate rejects an ITEL result by saying "Illinois has no matching policy", plus a second-round explanation for when the adjuster repeats that objection.
- **Where the work lives**: branch `claude/charming-bardeen-ficzd4` (https://github.com/nellie-approvalsteam/claims-navigator/tree/claude/charming-bardeen-ficzd4). No PR has been opened.
  - `content/templates.json`:
    - `tpl-illinois-itel-matching-rebuttal`: the first-round letter
    - `tpl-illinois-no-matching-second-rebuttal`: the second-round letter, cc'd to a supervisor
  - `content/scenarios.json`: `scn-itel-denied-no-matching-illinois`
  - `content/faq.json`: `kb-illinois-no-matching-objection`, an objection-by-objection guide
  - `content/carriers.json`: an Allstate note describing this denial pattern
- **Strategy**: Agree that Illinois has no matching statute, then argue the policy:
  - The replacement-cost promise is "like kind and quality". The independent ITEL report shows the shingle is discontinued and has no match, so a partial repair is not like kind and quality.
  - "No matching law" is not a policy exclusion. Ask Allstate to cite the specific policy language in writing.
  - The ITEL report is the only product evidence in the file. If Allstate says a match exists, it must name the manufacturer, line, color and supplier.
  - A roof is one interlocking system; brittleness tests can be used.
- **Authorities**:
  - *Windridge of Naperville v. Philadelphia Indemnity*, 932 F.3d 1035 (7th Cir. 2019), applying Illinois law: replacement of undamaged siding that would not match was required.
  - Contra proferentem (*Outboard Marine*, 1992).
  - The insurer bears the burden of proving an exclusion (*Addison v. Fay*, 2009).
  - 50 Ill. Adm. Code 919.50(a)(1): a denial must be in writing, cite the specific policy provision and include the Department of Insurance notice. **Confirmed.**
- **The KB guide**: answers 9 variants of the objection, including "it's cosmetic", "only the damaged slope", "ITEL isn't binding", "it'll weather in" and "back slope isn't visible". It also covers what not to say, when the argument is weak, and an escalation ladder.
- **Never cite 50 Ill. Adm. Code 919.80(d)(3)(A)** (the "reasonably uniform appearance" rule). It was removed because it almost certainly doesn't exist.
- **Open items**:
  - Counsel should verify *Windridge*, *Outboard Marine* and *Addison v. Fay*. *Windridge* was confirmed only from case summaries; the other two were cited from memory.
  - 215 ILCS 5/154.6 and 5/155 were not confirmed. Don't threaten bad faith in the first letter.
  - For each claim, paste in the insured's actual replacement-cost wording. If the policy has a real matching exclusion, a cosmetic-damage exclusion or a roof-surface endorsement, escalate internally instead of sending.
  - Get the homeowner's written authorization, and check Illinois rules on contractors negotiating with compliance.
  - Merge the branch or open a PR.
- **Escalation path**: appraisal, then an Illinois Department of Insurance complaint, then a lawyer.
- **Prompt to resume**:
```
I'm continuing work on the Claims Navigator repo, branch claude/charming-bardeen-ficzd4. A previous session added Illinois "no matching" ITEL rebuttal content for Allstate denials:
- content/templates.json: tpl-illinois-itel-matching-rebuttal (first-round) and tpl-illinois-no-matching-second-rebuttal (second-round)
- content/scenarios.json: scn-itel-denied-no-matching-illinois
- content/faq.json: kb-illinois-no-matching-objection
- an Allstate note in content/carriers.json

Strategy: agree that Illinois has no matching statute, and argue the policy's replacement-cost "like kind and quality" promise plus the ITEL report.
Do NOT cite 50 Ill. Adm. Code 919.80(d)(3)(A); it was removed as nonexistent.
Still unverified: Windridge v. Philadelphia Indemnity (932 F.3d 1035), Outboard Marine (1992), Addison v. Fay (2009), 215 ILCS 5/154.6 and 5/155.

Please check out the branch, review the content, help me verify those citations, then open a PR.
```

## Zero line estimate on denied claims
- **Session**: session_017yjYALU6F44ZxF7R43J49B — https://claude.ai/code/session_017yjYALU6F44ZxF7R43J49B
- **Goal**: Find out whether Allstate must provide a zero-line estimate on a fully denied claim, and draft a reply to the adjuster.
- **Where the work lives**: chat only. The denial letter PDF was uploaded to that session and is not in the repo. **Copy the final email draft out of the old session before you lose access.**
- **Answer**: Generally no. With a full no-coverage denial, the carrier doesn't have to write a zero-line estimate. Illinois (50 Ill. Adm. Code 919) requires a written denial that cites the policy provisions relied on. Exception: if the damage was below the deductible, an estimate or worksheet usually exists and can be requested.
- **The claim**:
  - Allstate, Illinois. Date of loss 07/03/2026. Denial letter dated 10/14/26.
  - The letter says:
    - the damage comes from prior paid claims that were never repaired
    - there was no new sudden and accidental loss
    - Exclusion D.11 (Planning, Construction or Maintenance) and Section 3 (What You Must Do After A Loss) apply, without explaining how
  - The adjuster is Mr. Ezzell.
- **Reply draft, version 3**:
  - From Proliance Public Adjusting Inc., on behalf of the homeowner.
  - Says the office compared the prior-claim scopes (which it already holds) against the current damage. Damage outside those scopes cannot be explained by them.
  - Requests:
    1. the inspection report, notes, photos and roof diagram for this claim
    2. for each claimed item (shingles and components, gutters and downspouts, window wrap and screens), which prior claim and which line items account for the damage
    3. how D.11 and Section 3 apply
  - Asks for a reinspection with the office present and a response within 15 business days (a reasonable deadline, not a statutory one).
- **Open items**:
  - Fill the placeholders: prior claim numbers and their dates of loss, the specific damage outside the prior scopes, the sender's name and phone.
  - Consider attaching a prior-scope vs. current-damage table and storm data for 7/3/26.
  - Escalation to the Illinois Department of Insurance was deliberately held back for later.
  - Unknown whether the email was sent.
- **Prompt to resume**:
```
I'm working an Allstate denial in Illinois (DOL 07/03/2026; I'll give you the claim number). Allstate's 10/14/26 letter denied the claim on these grounds:
- the damage is from prior paid claims that were never repaired
- there is no new sudden and accidental loss
It cites Exclusion D.11 (Planning, Construction or Maintenance) and Section 3 (What You Must Do After A Loss). The adjuster says there's no estimate because no covered damage was found.

A previous session concluded a zero-line estimate can't be required. It drafted a reply that:
- uses our copy of the prior-claim estimates as evidence (damage outside the prior scopes is new)
- asks Allstate to tie each damaged item to prior-claim line items
- asks how D.11 and Section 3 apply
- requests a reinspection with our office present, with a 15-business-day response window

I'll paste the denial letter, the prior estimates and the draft. Help me fill the placeholders, build a prior-scope vs. current-damage table, and plan escalation to the Illinois Department of Insurance if needed.
```

## Building codes CSV/PDF export
- **Session**: session_015JTaJa2U9bLKgSF7aQbzkF — https://claude.ai/code/session_015JTaJa2U9bLKgSF7aQbzkF
- **Goal**: Export the Notion "Building Codes" page to CSV and PDF, merge two "Illinois Claim Approval Codes" research spreadsheets into the exports and into Notion, and write a status summary for Mich.
- **Where the work lives**:
  - Notion "Building Codes": https://app.notion.com/p/Building-Codes-3ebc5e23903a81d8a464e1ca23db3737
  - Notion "Illinois Cities" database: https://app.notion.com/p/af22398c211045178f8daf441c9be7df (data source `collection://106e1357-f881-4988-b33e-45387bc967ee`). The app's `NOTION_CITIES_DATABASE_ID` points here.
  - Branch `claude/building-codes-export-gfx9v0`: `exports/building-codes/illinois-building-codes.csv` and `.pdf` (34 pages).
  - The build scripts were not committed.
  - The source spreadsheets were uploads and are not in the repo: `Illinois_Claim_Approval_Codes_First_15.xlsx` and `Illinois_Claim_Approval_Codes_Additional_Requirements_Verified.xlsx`.
- **Current state**:
  - The database has 60 cities.
  - Leverage columns added: Leverage rating, Adopted code, Code section, Verified requirement, How it helps, Carrier limitation, Adoption proof, Requirement proof, Leverage status, Leverage verified.
  - Oct 20 update:
    - 8 of the original 15 cities updated.
    - 45 cities added: 32 with full research and 13 placeholders.
    - Code edition corrected for South Holland (2021 IRC), Hickory Hills, Naperville, Bridgeview and Lombard (2024 IRC), and Dolton (2012 IRC).
  - Strongest leverage cities: Hickory Hills (VERY STRONG, matching rule), Mokena (full-slope rule), Joliet (no patching), Justice (sheathing rule), Lombard, Oak Lawn, Wheeling, and Chicago (STRONG, §14R-3-306).
- **Open items**:
  1. Code-edition conflicts need a call to each city: Frankfort, Berwyn, Calumet City, Lisle, Sauk Village, Joliet.
  2. Markham is still "Verified", but §150.086 still needs text verification. Revert it to "In progress".
  3. West Chicago's Notes wrongly say roof permits include an ice & water inspection. The city does no roof inspections.
  4. Ice & water shield is still "Unknown" for South Holland, Lombard, Lisle and Joliet, although their city guides require it.
  5. "Verified by" is blank on the Verified cities.
  6. 13 placeholder cities need research: Addison, Alsip, Downers Grove, Glenwood, Harvey, Hinsdale, Lansing, Matteson, Monee, Orland Park, Somonauk, Steger, Tinley Park.
  7. The "What the labels mean" section doesn't explain Leverage rating.
  8. The PDF and CSV are stale. Regenerate them from Notion.
- **Key context**:
  - A rule about what happens *when* a roof is replaced is not a rule *requiring* replacement.
  - Ask before changing the shared database; accuracy comes before speed.
- **Prompt to resume**:
```
I'm continuing work on our Notion "Building Codes" page (https://app.notion.com/p/Building-Codes-3ebc5e23903a81d8a464e1ca23db3737) and its "Illinois Cities" database (https://app.notion.com/p/af22398c211045178f8daf441c9be7df), 60 cities with leverage columns. Exports are on branch claude/building-codes-export-gfx9v0 of the claims-navigator repo.

Still open:
(1) Code-edition conflicts for Frankfort, Berwyn, Calumet City, Lisle, Sauk Village and Joliet
(2) Revert Markham's Research status to In progress
(3) Fix West Chicago's Notes (no roof/ice & water inspections)
(4) Set Ice & water shield to Required for South Holland, Lombard, Lisle and Joliet
(5) Research the 13 placeholder cities
(6) Add a Leverage rating explanation to "What the labels mean"
(7) Regenerate the PDF/CSV from Notion

Ask me before changing the shared database. Start by reading the current Notion state and confirming which of these to do.
```

## Insurance company tools and acceptance
- **Session**: session_01F9TUhLz65KfvQYzSNYLLPs — https://claude.ai/code/session_01F9TUhLz65KfvQYzSNYLLPs
- **Goal**: Find out which tools and evidence carriers accept in hail disputes. The team uses Interactive Hail Maps and HailTrace.
- **Answer (chat only)**:
  - No carrier keeps an official list of approved tools. Hail maps are fine for prospecting and the date of loss, but adjusters treat them as marketing-grade.
  - Weather evidence, strongest first:
    1. NOAA/NWS public data: NCEI Storm Events, SPC storm reports, NEXRAD MESH
    2. the carrier's own vendor (CoreLogic or Verisk); match your date of loss to it
    3. a forensic meteorologist (AMS CCM) for big disputes
    4. HailTrace and Interactive Hail Maps as supporting evidence only
  - Most disputes turn on "no functional damage" or "wear and tear". What wins those:
    - HAAG-certified inspectors
    - thorough photos: test squares, a scale reference, collateral damage
    - EagleView or Hover measurements
    - Xactimate estimates
  - When the carrier won't move: reinspection, rebut the engineer's report, appraisal, a public adjuster or an attorney.
- **Open item**: a claim-packet evidence checklist was offered but not built. It would fit as Claims Navigator content.
- **Prompt to resume**:
```
Our team fights hail/roof claim denials (mostly Illinois). A previous session advised these as the evidence carriers accept:
- NOAA/NCEI Storm Events, SPC reports and NEXRAD MESH on every claim file
- matching the carrier's weather vendor (CoreLogic/Verisk)
- a forensic meteorologist only for big disputes
- HAAG-certified inspectors and thorough photos
- EagleView/Hover measurements and Xactimate estimates
Please build a claim-packet evidence checklist and add it as content to our Claims Navigator app (content/*.json) on a new branch.
```
