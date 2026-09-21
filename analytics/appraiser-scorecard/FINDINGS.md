# Contractors Cloud data audit — appraiser increase analysis

**Date:** 2026-09-21
**Method:** direct inspection of the live Contractors Cloud tenant (8,676 projects)
via the reporting API — entity schemas, filter value enumerations, and sampled rows.
Three scratch reports were created for the audit and deleted afterward.

## Conclusion

**The data required to rank appraisers by increase is not currently captured in
Contractors Cloud.** Not incomplete, not messy — absent. There is no field anywhere
in the tenant that records which appraiser worked a claim, and no field that records
the appraisal award amount.

This is the explanation for the unreliable results from earlier attempts. The
question was being asked of fields that were never designed to answer it, so any
number returned had to be inferred from free text or adjacent financials. That is
why the answers did not reconcile between runs. **The tool was not the problem, and
switching tools will not fix it.**

The good news: this is an intake problem, which is cheap to fix going forward. The
bad news: it is not retroactive. History that was never recorded cannot be
recovered from the CRM, only from documents.

## Evidence

### 1. No appraiser field exists

The tenant defines exactly 22 project custom fields. The complete list:

> Adjuster Email · Adjuster Name · Adjuster Phone # · Adjuster's Extension ·
> Any Prior Claims For This Client? · Approval Department Notes · Claim Number ·
> Date Of Loss · Deductible · Existing Client's Referral · H O A ·
> How Many Stories? · Insurance Company · Interior? · Is There Code Coverage? ·
> Lead Type · Lor Confirmed? · Miscellaneous · Policy Number · Preferred Language ·
> Special Endorsements? · Type Of Policy?

No appraiser field. The `claim` entity carries Agent, Field Adjuster and In-House
Adjuster — all carrier-side or internal roles — and no appraiser.

### 2. No appraisal milestone exists

The workflow's milestone names were enumerated across all 183,397 milestone
instances. Sorted alphabetically, the list goes directly from
`*Adjuster Meeting Confirmation` to `*Cancel Project (Part 1/2) - Approval
Department Cancellation`. Nothing between them. There is no appraisal milestone,
so there is no timestamped record of a claim entering or leaving appraisal — and
therefore no cycle time and no historical population.

### 3. Claim status cannot reconstruct history

A claim status of `Appraisal` (id 35) does exist. Exactly **2 claims** currently
hold it, both on Cancelled projects with $0 estimated. Status is current-state
only: a claim that went through appraisal and closed now reads `Closed`, with no
trace of having been in appraisal. The population of past appraisals is therefore
not queryable.

### 4. Estimate records do not distinguish before from after

Estimate types available: `EagleView`, `Estimate - Insurance`,
`Estimate - Retail (Per Unit)`, `Installed Materials`, `Warranty`. One category:
`Retail`. Nothing marks an estimate as the carrier's pre-appraisal position versus
the appraisal award, so "first vs. last insurance estimate" would be a guess about
what each record represents — exactly the kind of guess that produces numbers that
do not reconcile.

### 5. The informal tracking confirms the gap

Two artifacts show the team working around the missing fields:

- A contact record whose **last name** is `Owusuv *APPRAISAL*` — a marker typed
  into a customer's name to flag the claim.
- `Approval Department Notes` contains appraisal text, but about **fees**, not
  appraisers or amounts: *"appraisal fee is $950"*, *"Appraisal fee is waived.
  Approved by Alan"*, *"No appraisal fee - Approved by Alan"*.

Only **25 projects out of 8,676** have any text in that field at all. Even the
informal record is close to empty. The field is also not substring-searchable
through reporting (its filters are exact-match only), so it cannot be mined at
scale.

## What to do

### Fix intake — small, and it starts the clock today

Six fields, captured once per appraisal claim. This is the whole fix.

| Field | Type | Notes |
|---|---|---|
| Appraiser | dropdown | **Dropdown, never free text.** A typed name spelled two ways splits one appraiser's record in half and is nearly invisible. |
| Pre-Appraisal RCV | currency | The carrier's RCV immediately *before* appraisal was invoked. Ambiguity here corrupts everything downstream — pin it to one document. |
| Award RCV | currency | The signed award amount. |
| Appraisal Invoked Date | date | Start of cycle time. |
| Award Date | date | End of cycle time. |
| Umpire Used | yes/no | Umpire rate is a real cost and a competence signal. |

Add an `Appraisal` milestone to the workflow so entry and exit are timestamped
without anyone typing a date.

Appraiser fee is worth capturing too if it varies by appraiser or by arrangement —
it is what separates gross increase from what you actually keep. If it is not
captured, the pipeline falls back to the fee model in `config/settings.yml`, which
is an assumption rather than a measurement and should be labelled as such whenever
the results are presented.

### Recovering history — decide whether it is worth it

Roughly 200–1000 past appraisals were expected. Reconstructing them means pulling
the carrier estimate and award document for each claim and extracting two figures.
That is what this pipeline does, and it is built for exactly this job — but
attribution is the binding constraint: **even with perfect document extraction,
nothing in the CRM says which appraiser worked which claim.** That has to come from
someone's memory, an email archive, or the award documents themselves (an award
names the appraisers who signed it, which is the most promising source).

Three options, in order of what I would recommend:

1. **Start clean.** Fix intake now, run the first real scorecard in two to three
   quarters once enough claims have accumulated. Cheapest and most reliable.
2. **Backfill a sample.** Reconstruct 60–100 recent claims by hand to get a
   directional read sooner. Enough to spot a clear outlier, not enough to separate
   the middle of the roster — and the report will say so rather than pretend
   otherwise.
3. **Full backfill.** Only worth it if the award documents are reliably filed and
   reliably name the appraiser. Worth checking a dozen claims before committing to
   the whole set.

### What not to do

Do not rank appraisers on what is currently extractable. Between missing
attribution, missing award amounts and an unqueryable population, any ranking
produced today would be reconstructed from adjacent financials and free text. It
would look like an answer, it would be wrong in ways nobody could audit, and
someone would make a vendor decision on it.
