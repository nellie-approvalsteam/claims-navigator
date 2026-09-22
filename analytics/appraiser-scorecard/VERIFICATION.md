# How to check these findings yourself

Everything below is reproducible from the "Approval Department" Google Sheet.
Files referenced are in this folder.

## 1. The strongest check: my numbers vs YOUR pivot table

The workbook's own **`Pivot Table 5`** tab summarises 2025. I never used it to
build the analysis — so it is a genuinely independent check on my extraction.

| Segment | My deals | Pivot | My $ | Pivot $ | |
|---|---:|---:|---:|---:|:--|
| Appraisal AND Reinspection / Jason | 3 | 3 | 64,720 | 64,720 | ✅ |
| Appraisal AND Reinspection / Zack | 46 | 46 | 1,084,876 | 1,084,876 | ✅ |
| Appraisal Only / Jason | 54 | 54 | 950,254 | 950,254 | ✅ |
| Appraisal Only / Joseph | 12 | 12 | 239,825 | 239,825 | ✅ |
| Appraisal Only / Zack | 87 | 87 | 1,657,020 | 1,657,020 | ✅ |
| Reinspection Only (all) | 304 | 304 | 3,551,768 | 3,551,768 | ✅ |
| Supplement (all) | 38 | 38 | 355,205 | 355,205 | ✅ |
| **Grand total 2025** | **562** | **562** | **8,353,279** | **8,353,279** | ✅ |

Every line matches to the dollar. `verification_reconciliation.csv`

**Caveat:** the pivot only covers 2025. There is no equivalent pivot for 2026,
which is where the headline ranking comes from — so this validates the
*extraction method*, not the 2026 numbers themselves.

## 2. How 1,460 rows became 583

`verification_all_1460_rows.csv` has **every row** of the `Data` tab with an
`in_analysis` flag and an `excluded_because` reason. Nothing is silently dropped.

| Step | Rows |
|---|---:|
| Rows with a client name | 1,460 |
| …that are appraisal deals | 638 |
| …with an appraiser named | **583** ← the analysis set |
| Appraisal deals with no appraiser named | 55 (excluded — cannot attribute) |

The 822 excluded non-appraisal rows are Reinspection Only, Supplement, and New
DOL. If you think any of those belong in an appraiser comparison, say so and I
will re-run — it would change the answer.

## 3. Deals per appraiser per year

| Appraiser | 2023 | 2024 | 2025 | 2026 |
|---|---:|---:|---:|---:|
| Zack | 10 | 3 | 133 | 136 |
| Jason | 0 | 0 | 57 | 100 |
| Mitchell | 0 | 0 | 0 | 77 |
| Jakub | 0 | 0 | 0 | 38 |
| Joseph | 0 | 0 | 12 | 8 |
| Anthony | 5 | 2 | 0 | 0 |

This table is the whole reason the headline uses 2026 only. Mitchell and Jakub
have **zero** deals before 2026. Comparing them against Zack's full record would
compare different years, and 2026 ran ~8% higher than 2025.

## 4. Spot-check individual deals

`verification_spotcheck.csv` lists each appraiser's 3 largest and 3 smallest 2026
deals with client name, carrier and amount. Open the sheet, find the client, and
confirm the figure. If those 30 rows are right, the aggregates are right.

## 5. Judgement calls you should second-guess

These are choices, not facts. Each one could reasonably go the other way:

| Call | What I did | Why it matters |
|---|---|---|
| **MITCH = MITCHELL** | Merged as one person | If they are two people, his 78 deals split and he drops out of the ranking |
| **Excluded 55 unattributed deals** | Dropped | If those are mostly one appraiser's, that appraiser's record is incomplete |
| **log(dollars) not raw dollars** | Ranked on log | Raw dollars would let a few large claims decide it; log is more conservative |
| **2026-only headline** | Restricted | The all-years table is in the workbook and ranks Mitchell first instead |
| **15-deal minimum to rank** | Anthony (7) excluded | Below that, shrinkage makes the estimate meaningless |

## 6. What would falsify the finding

- **Zack's caseload is systematically harder.** Assignment is by capacity, and
  caseloads balance on carrier, roof size, claim type and state — but "harder"
  is not recorded anywhere. If it is real, it is invisible here.
- **The 55 unattributed deals are concentrated.** Would change the picture.
- **$0 and withdrawn appraisals are missing.** If losses are not logged, an
  appraiser who drops weak claims looks better than one who fights them.

The third is the one I would check first.
