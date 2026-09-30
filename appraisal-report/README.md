# Appraisal claims report automation

Scripts and agent instructions behind the "2026 Appraisal Claims" report in Google
Drive. A scheduled Claude Code routine runs `ROUTINE.md` each weekday: it finds new
appraisal rows in the Approval Department sheet, reads each claim's documents in
Contractors Cloud, and uploads an "added <date>" workbook to the report folder.

| File | Purpose |
|---|---|
| `ROUTINE.md` | Step-by-step runbook for the scheduled session |
| `INSTRUCTIONS.md` | Per-claim extraction rules (estimates, award, increase, scope, property) |
| `detect_new.py` | Finds appraisal rows not yet in the report (keyed by hash) |
| `fetch.py` | Downloads claim PDFs and extracts their text |
| `build_report.py` | Builds the Excel report from per-claim results |
| `baseline_keys.txt` | Hashed keys of the rows in the original 382-claim report |

No client data is stored in this repo: claim results live only in the run's
temporary directory and in the Drive report; `baseline_keys.txt` holds one-way hashes.
