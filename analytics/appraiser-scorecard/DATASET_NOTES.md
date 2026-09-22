# Appraisal dataset — what's here and what isn't

**Extracted 2026-09-21/22 from Contractors Cloud, read-only.**
86 unique projects that completed the `*Perform Appraisal` milestone.

## How the population was found

`*Perform Appraisal` is a real workflow milestone (I was wrong in my first audit —
I'd binary-searched the milestone list only as far as `*G`, and it sorts under
`*P`). Filters used: milestone status = Completed, project status in
{Closed - Complete, Closed Pending, Accounts Receivable, Post-Production}.

Related milestones that also exist: `*Pitch Appraisal`, `*Perform Reinspection`,
`*Pitch Reinspection`.

93 milestone instances collapsed to 86 projects. 6 projects had more than one
instance (re-entry or a genuine second round) — collapsed to first start / last
end, which understates cycle time on a true second round rather than
double-counting the project. 1 test row (`Fake, Another`) excluded.

## Populated (10 columns)

project_number, customer, final_approved_amount, date_assigned, date_completed,
cycle_days, project_status, state, rep, milestone_instances

- `date_assigned` / `date_completed` = milestone start / end. These are real and
  timestamped — cycle time is measurable today.
- `final_approved_amount` = project **sold amount**. This is the signed contract
  value, which is a *proxy* for the final approved figure, not the same thing.

## Empty, and why (12 columns)

| Column | Why |
|---|---|
| `appraiser` | **No appraiser field exists anywhere in the CRM.** Not in the 22 project custom fields, not on the claim (which has Agent / Field Adjuster / In-House Adjuster only). Occasionally inferable from document filenames — project 212743 has `Appraisal Document Advocate appraisal group...` and `Bhattachariee Ampion Award.pdf` — but sampling showed this is sparse: projects 212676 and 212961 have award/demand documents with no appraiser named. |
| `original_carrier_estimate` | Exists only inside attached PDFs. The Estimates module is unused in this tenant — `estimate_search` returned **0 estimates** on every project tested, which is why the `Estimated ($)` rollup is `$0.00` on all 86 rows. |
| `appraisal_award` | Same. Award documents are clearly there and well named (`Pitroda Appraisal - Award.pdf`, `BHA--AWD.PDF`, `13-88P1-54Z IL Appraisal Award Letter.pdf`) — the figures are inside them. |
| `increase_usd`, `increase_pct` | Derived from the two above. |
| `claim_number`, `carrier` | On the `claim` entity. Obtainable read-only, one join per project — not done here to stay within a bounded number of API calls. |
| `trade`, `home_size_roof_squares`, `home_size_siding_squares` | Derivable from the project `name` field, which encodes scope as `R: 50 SQ, S: 0 SQ, G: 0 LF` (roof squares / siding squares / gutter linear feet). Populated on some projects, null on others. |
| `roof_material`, `siding_material` | No field in the CRM. Would come from the estimate or EagleView documents. |

## The blocker

Document URLs live on `*.rackcdn.com` and
`prod-contractors-cloud.nyc3.digitaloceanspaces.com`. Both are **denied by this
session's egress policy** (403 on CONNECT). So the award and estimate PDFs could
not be fetched or parsed here. This is an environment restriction, not a data
problem — the documents exist and are well organised.

## What unblocks the analysis

1. **Allow-list the two document hosts** for the session, or export the award +
   carrier-estimate PDFs for these 86 projects to somewhere reachable. Then the
   extraction pipeline in `analytics/appraiser-scorecard/` parses them, refusing
   anything ambiguous instead of guessing.
2. **Appraiser attribution is the harder half.** Even with every PDF parsed,
   nothing in the CRM says who the appraiser was on most of these. The award
   documents name the signing appraisers — that is the most promising source, and
   worth checking on a dozen before committing to all 86.
3. **Fix intake** so this is never a reconstruction job again: an Appraiser
   dropdown, Pre-Appraisal RCV, and Award RCV captured at award time.
