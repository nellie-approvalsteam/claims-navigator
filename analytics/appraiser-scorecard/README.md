# Appraiser Increase Scorecard

Which appraiser gets the best increases, controlling for trade, claim size, material
and carrier — answered in a way you can defend when someone disagrees with it.

> **Read `FINDINGS.md` first.** A live inspection of the Contractors Cloud tenant on
> 2026-09-21 found that the data this pipeline needs **is not currently captured**.
> This tool is complete and tested, but it cannot produce a real scorecard until the
> intake gap described in that document is closed. Nothing here will invent the
> missing numbers.

---

## Why this exists as code instead of a prompt

The instinct is to point an AI at the CRM and ask who the best appraiser is. That
fails in two distinct ways, and they need two different fixes.

**It cannot do the arithmetic reliably.** A model reading hundreds of claim records
and computing averages drifts, and the drift is invisible — the answer looks
plausible every time and changes between runs. So all arithmetic here happens in
code, against a frozen snapshot. The model's job is to interpret a small computed
table (`out/scorecard.json`, about 5 KB), never to compute from raw rows.

**It cannot refuse.** Asked for "the RCV" on a document that does not clearly state
one, a model returns a number anyway. This pipeline's extractor returns *nothing*
and explains why, routing the claim to a human. On the 260-claim test fixture that
refusal caught 32 claims — including every case where the award document was
missing and the carrier's own estimate would otherwise have been read as the award,
silently reporting a 0% increase.

That second property is the whole point. **Half the value of this tool is the
claims it declines to score.**

---

## What it measures

Per claim:

| Metric | Why it is here |
|---|---|
| `increase_usd` | award RCV − pre-appraisal RCV. What you banked. |
| `increase_pct` | scale-free, so a $6k siding claim and an $80k tile roof are comparable |
| `net_increase_usd` | increase minus appraiser fee minus your share of the umpire fee |
| `net_increase_pct` | **the default ranking metric** |
| `cycle_days` | appraisal invoked → award signed |
| `umpire_needed` | umpire rate is both a cost and a competence signal |

`net_increase_pct` is the default because gross increase flatters a
percentage-fee appraiser. A 22% gain at a 15% fee nets less than an 18% gain at a
flat fee, and only the net figure says so.

## How the ranking works

1. **Stratify.** Each claim is scored against the mean for *its own* carrier × trade
   × size band, not against the roster average. This is what turns "got bigger
   numbers" into "did better than expected for that kind of claim."
2. **Fall back, don't discard.** A claim whose full stratum is too thin is compared
   at the finest level that still has data (carrier × size → trade × size → size).
   The level used is reported per claim, because a roster compared mostly at "size
   alone" is barely controlled and you should know that.
3. **Shrink.** Empirical-Bayes shrinkage pulls each appraiser toward the roster
   average in proportion to how little data stands behind them. One lucky award on
   six claims cannot top the table.
4. **Bootstrap, then tier.** A cluster bootstrap gives each appraiser an interval.
   Appraisers whose intervals overlap the tier leader's are reported as **one tier**,
   because on a roster this size the honest answer is often "these three are
   indistinguishable." The report is built to be able to say that, and says it.

There is also an **assignment-bias diagnostic** (§3 of every report). It changes no
score. It tells you when an appraiser's caseload is too lopsided for the comparison
to mean much — which, on a roster where specialists hand-pick who gets which claim,
is the failure mode most likely to make the whole exercise misleading.

### Validated against known ground truth

`tests/make_fixtures.py` generates 260 synthetic claims with appraiser effects,
carrier/trade confounders and assignment bias planted deliberately, plus realistic
document defects. The pipeline recovers the planted ordering exactly, flags the
planted caseload concentration, and refuses to rank the appraiser who was given a
strong effect but only seven claims.

Effect sizes come back **compressed** relative to what was planted (a 6.4pp spread
recovered from an 11.5pp planted spread). That is expected: stratum means absorb
part of an appraiser's own effect where they dominate a stratum, and shrinkage pulls
the rest in. Treat the adjusted numbers as a reliable *ordering* with conservative
magnitudes, not as a precise estimate of how many points each appraiser is worth.

---

## Running it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 1. ALWAYS start here. Read-only; tells you what will work and what will not.
.venv/bin/python -m scorecard.cli doctor export.csv

# 2. Full run.
.venv/bin/python -m scorecard.cli run export.csv --pdf-dir ./pdfs

# 3. Open out/review-queue.csv, fill in CONFIRMED_VALUE where a human is needed,
#    then re-run. Confirmations are keyed by job id and persist across exports —
#    confirming a figure once should never have to happen twice.
.venv/bin/python -m scorecard.cli run export.csv --pdf-dir ./pdfs \
    --review out/review-queue.csv
```

Outputs land in `out/`:

- `scorecard.md` — for people. Leads with data quality, then tiers, then caveats.
- `scorecard.json` — for Claude. Small, pre-computed, one row per appraiser.
- `claims-scored.csv` — every claim with its metrics, stratum and exclusion reason.
- `review-queue.csv` — what needs a human, with full provenance.
- `run-report.json` — column mapping, unmapped values, exclusion tallies.

Snapshots are frozen to `snapshots/claims-<timestamp>.csv` on every run and all
downstream work reads the snapshot. Re-querying live data mid-analysis is how two
runs a week apart disagree about a claim that closed months ago.

### Handing the result to Claude

Paste `out/scorecard.json` with a prompt like:

> Here is a computed appraiser scorecard. Do not recompute any figure — every
> number is already calculated. Tell me: which differences are real given the
> confidence intervals and tiers, which appraisers are not comparable because of
> the bias flags, and what the data-quality section means for how much weight I
> should put on this. Say plainly if the data does not support a ranking.

## Configuration

Everything that changes the answer lives in `config/`, not in code, so every
threshold in a report is one you can point at and argue about.

- `columns.yml` — maps your export's headers to canonical fields. **Edit this first.**
- `carriers.yml` — carrier name normalization. Unmapped carriers are excluded and
  listed at the top of every report; do not ignore that list.
- `trades.yml` — trade and material normalization.
- `settings.yml` — confidence floors, validity bounds, stratum minimums, the
  8-claim ranking threshold, bootstrap settings, fee model, bias thresholds.

## Fixing this at the source

PDF extraction exists because the numbers are not in fields. It is a workaround, and
it will always lose some claims. The permanent fix is to capture two figures at
claim close. See `FINDINGS.md` for the specific fields to add. Once they exist,
name them in `columns.yml` under `pre_rcv_field` / `award_rcv_field` and the
pipeline uses them directly — a typed number someone is accountable for beats a
regex every time, and the review queue mostly empties.

## Tests

```bash
.venv/bin/python -m pytest tests/test_units.py -q      # 20 tests
.venv/bin/python tests/make_fixtures.py --out /tmp/fx --claims 260
.venv/bin/python -m scorecard.cli run /tmp/fx/export.csv --pdf-dir /tmp/fx/pdfs
```

`reportlab` is needed only to generate fixtures, not to run the pipeline.
