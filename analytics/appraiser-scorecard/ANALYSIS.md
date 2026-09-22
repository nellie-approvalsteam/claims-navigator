# Which appraiser produces the strongest increases?

**Answer: the ordering is consistent, but the data does not yet support ranking
them.** All five rankable appraisers fall in one statistical tier. Read the
caveat in §4 before acting on anything here — it is the one that matters.

**Source:** "Approval Department" Google Sheet, `Data` tab — 1,460 logged results
2023–2026. Filtered to deals where work was an appraisal **and** an appraiser is
named: **583 deals**. Read-only; nothing in the sheet or in Contractors Cloud was
modified.

## 1. The ranking

Deals are compared within **carrier × deal type** (536 of 583; the remaining 47
fell back to deal type alone). `adjusted` is how much more or less an appraiser
generates than expected *for that kind of deal*, after empirical-Bayes shrinkage.
Interval is 90%, cluster bootstrap, 2,000 resamples.

| Tier | Appraiser | Deals | Adjusted | 90% interval | Median $ | Mean $ | Total $ |
|---:|---|---:|---:|---|---:|---:|---:|
| 1 | Mitchell | 78 | **+14%** | −4% … +38% | $19,156 | $22,225 | $1,733,555 |
| 1 | Zack | 282 | **+9%** | −2% … +22% | $17,147 | $22,397 | $6,316,080 |
| 1 | Joseph | 20 | **+2%** | −9% … +17% | $14,058 | $16,816 | $336,316 |
| 1 | Jason | 157 | **−7%** | −19% … +4% | $15,817 | $16,437 | $2,580,623 |
| 1 | Jakub | 39 | **−31%** | −60% … +0% | $13,813 | $13,055 | $509,127 |

Anthony (7 deals) is below the 15-deal threshold and is not ranked.

**Every interval crosses zero, so all five sit in one tier.** No appraiser is
distinguishable from the roster average at 90% confidence. Between-appraiser
variance is real but small (τ² = 0.064), which is why shrinkage pulls the
estimates well in toward the middle.

## 2. What is suggestive

The *ordering* is stable across every cut, which is more than noise usually
manages:

| Cut | Top | Bottom |
|---|---|---|
| Overall adjusted | Mitchell | Jakub |
| State Farm (n=304) | Mitchell $18.3k | Joseph $12.4k |
| Allstate (n=182) | Mitchell $21.9k | Joseph $12.9k |
| Appraisal Only (n=476) | Mitchell $19.9k | Jakub $14.0k |
| Appraisal AND Reinspection (n=107) | Mitchell $18.1k | Zack $15.4k |

Mitchell tops four of five cuts. Jakub or Joseph is bottom in four of five. That
consistency is worth watching — but it is the same 78 deals being re-cut, so it
is not five independent confirmations.

**Zack is the volume story.** 282 deals and $6.3M generated — 48% of all dollars
in the set, and more than double anyone else — at an adjusted rate slightly above
average. On total contribution he is the most valuable appraiser on the roster by
a wide margin, whatever the per-deal ranking says.

## 3. By claim type

Both major carriers behave similarly (State Farm median $17.2k, Allstate $16.9k),
so carrier is not a strong differentiator here. Mitchell leads on both, and leads
by more on Allstate (+29% over the carrier median vs +6% on State Farm) — the
closest thing to a "specific type of claim" signal in the data, on 28 deals.

`Appraisal AND Reinspection` deals generate slightly *less* than
`Appraisal Only` ($15.6k vs $16.9k median), which is worth a second look — it is
the opposite of what more work would suggest.

## 4. The caveat that matters

**There is no claim size in this data, so none of the above is size-normalized.**

The sheet records the dollars generated but not the carrier's original estimate.
I checked all 15 tabs — no original/pre-appraisal/RCV column exists anywhere. So
every figure here is *dollars per deal*, not efficiency, and **claim size is
completely uncontrolled**.

That matters because a $19k increase on a $150k claim is a weaker result than a
$19k increase on a $40k claim. If Mitchell is routed larger claims, his +14% is
an artifact of assignment rather than skill, and nothing in this dataset can tell
the difference. That single missing column is the difference between "suggestive"
and "decisive".

Also unmeasured: no cycle time (the `Data` tab's entry/result dates are
unreliable — several results predate entry), and the umpire column is nearly
always blank.

## 5. What would settle it

1. **Capture the carrier's original estimate** alongside the dollars generated —
   one column in the sheet. Everything above becomes a percentage increase,
   size-normalized, and the tiers likely separate.
2. **Check assignment.** Pull claim size for a sample of Mitchell's 78 and Zack's
   282 deals. If Mitchell's are systematically larger, his lead shrinks or
   reverses.
3. **Fix `MITCH` / `MITCHELL`.** They are one person spelled two ways across the
   trackers; merged here, but it would have split his record in half.

Until (1) exists, the defensible statement is: *Mitchell and Zack trend above
average, Jakub trends below, and the roster is not separable on current data.*
Do not move vendor volume on this alone.
