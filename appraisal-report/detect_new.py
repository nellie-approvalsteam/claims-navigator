#!/usr/bin/env python3
"""Find appraisal rows in the Approval Department sheet that are not in the report yet.

Usage: detect_new.py <approvals.xlsx> <known_keys.txt> <out_dir>

Reads the "Data" tab, keeps rows from 2026 onward whose "What was performed"
contains "Appraisal", and compares each row's key (hash of client, address,
result date and amount) with the known keys. Writes:
  <out_dir>/batch.json     one entry per client with a new row (same shape the
                           agents' INSTRUCTIONS.md expects; id = client key)
  <out_dir>/all_keys.txt   known keys + the new ones (upload as the next state)
Prints the number of new rows and clients.
"""
import datetime, hashlib, json, os, re, sys

import openpyxl

norm = lambda s: re.sub(r"\s+", " ", str(s or "").strip().lower())


def day(v):
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.strftime("%Y-%m-%d")
    return str(v or "")[:10]


def row_key(client, address, result, amount):
    try:
        amt = "%.2f" % float(amount or 0)
    except (TypeError, ValueError):
        amt = str(amount)
    raw = "|".join([norm(client), norm(address), day(result), amt])
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def main():
    xlsx, known_path, out = sys.argv[1:4]
    known = {l.strip() for l in open(known_path) if l.strip()}
    ws = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)["Data"]
    rows = []
    for r in list(ws.iter_rows(values_only=True))[3:]:
        r = list(r)[:14] + [None] * 14
        entered, result, year, client, address, state, typ, amount, appraiser, specialist, insurer, umpire, notes = r[1:14]
        if not client:
            continue
        yr = year if isinstance(year, int) else (result.year if hasattr(result, "year") else None)
        if not yr or yr < 2026:
            continue
        rows.append(dict(entered=day(entered), result=day(result), client=str(client).strip(),
                         address=re.sub(r"\s+", " ", str(address or "")).strip(), state=state,
                         type=typ, amount=amount, appraiser=appraiser, specialist=specialist,
                         insurer=insurer, umpire=umpire, notes=notes))
    new_rows = [x for x in rows if x["type"] and "Appraisal" in str(x["type"])
                and row_key(x["client"], x["address"], x["result"], x["amount"]) not in known]
    by_client = {}
    for x in new_rows:
        by_client.setdefault(norm(x["client"]), x)
    batch = []
    for nc, first in by_client.items():
        all_rows = [x for x in rows if norm(x["client"]) == nc]
        batch.append(dict(
            id=hashlib.sha1(nc.encode()).hexdigest()[:12], client=first["client"], address=first["address"],
            state=first["state"], insurer=next((x["insurer"] for x in all_rows if x["insurer"]), None),
            sheet_rows=[{k: x[k] for k in ("entered", "result", "type", "amount", "appraiser", "specialist", "umpire", "notes")}
                        for x in all_rows]))
    os.makedirs(out, exist_ok=True)
    json.dump(batch, open(os.path.join(out, "batch.json"), "w"), indent=1, default=str)
    keys = known | {row_key(x["client"], x["address"], x["result"], x["amount"]) for x in new_rows}
    open(os.path.join(out, "all_keys.txt"), "w").write("\n".join(sorted(keys)) + "\n")
    print(f"new appraisal rows: {len(new_rows)}; clients to process: {len(batch)}")


if __name__ == "__main__":
    main()
