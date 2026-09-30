#!/usr/bin/env python3
"""Export the Claims tab of an update workbook as CSV for a Google Sheet upload.

Usage: claims_csv.py <update.xlsx> <out.csv>

The Drive upload is sent inline, so the CSV leaves out the long per-estimate scope
columns (the dashboard has them). Claim and policy numbers are written as ="..."
so Google Sheets keeps their leading zeros.
"""
import csv, sys

import openpyxl

DROP = {"Files Read", "Initial Estimate Scope", "Reinspection Estimate Scope", "Award Scope", "Roof / Property Details"}
TEXT = {"Claim #", "Policy #"}


def main():
    src, out = sys.argv[1:3]
    ws = openpyxl.load_workbook(src, data_only=True)["Claims"]
    rows = [r for r in ws.iter_rows(values_only=True) if any(v is not None for v in r)]
    hi = next(i for i, r in enumerate(rows) if r[0] == "#")
    head = rows[hi]
    keep = [j for j, h in enumerate(head) if h not in DROP]
    with open(out, "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow([head[j] for j in keep])
        for r in rows[hi + 1:]:
            cells = []
            for j in keep:
                v = r[j]
                if v is None:
                    v = ""
                elif isinstance(v, float):
                    v = round(v, 2)
                elif head[j] in TEXT and str(v).strip():
                    v = '="%s"' % str(v).replace('"', "'")
                cells.append(v)
            w.writerow(cells)
    print(f"wrote {len(rows) - hi - 1} rows to {out}")


if __name__ == "__main__":
    main()
