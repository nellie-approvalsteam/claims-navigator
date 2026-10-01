#!/usr/bin/env python3
"""Turn claim results into dashboard rows (one JSON file per claim).

Usage: to_dashboard.py --dir <run dir> --clients <batch.json|clients.json> --out <out dir>

Each output file <out>/<doc_id>.json is one document for the dashboard's
"claims" collection. doc_id is sha1(normalized client name)[:12], the same id
detect_new.py gives a client, so a later run for the same client overwrites it.
"""
import argparse, glob, hashlib, json, os, re

norm = lambda s: re.sub(r"\s+", " ", str(s or "").strip().lower())


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    try:
        return round(float(str(v).replace("$", "").replace(",", "")), 2)
    except ValueError:
        return None


def g(d, *ks):
    for k in ks:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d


def scope(est):
    out = []
    for x in (est or {}).get("scope") or []:
        out.append({"item": scope_group(x.get("item")), "rcv": num(x.get("rcv")) or 0,
                    "detail": str(x.get("detail") or "")[:300]})
    return out


CARRIERS = ["AAA", "State Farm", "Allstate", "Farmers", "Liberty Mutual", "Hartford", "Travelers", "American Family",
            "Nationwide", "Country", "Erie", "Auto-Owners", "Safeco", "Encompass", "Chubb", "USAA"]


def carrier_group(name):
    n = norm(name)
    for c in CARRIERS:
        if norm(c) in n:
            return c
    return re.split(r"[(,]", str(name or "Unknown"))[0].strip() or "Unknown"


def cause_group(text):
    t = norm(text)
    hail, wind = "hail" in t, "wind" in t
    if hail and wind:
        return "Hail & wind"
    return "Hail" if hail else "Wind" if wind else ("Other" if t else "Unknown")


SCOPE_GROUPS = [("solar", "Solar D&R"), ("tax", "Sales tax / O&P"), ("code", "Code upgrade / O&L"),
                ("other structure", "Other structure roofs"), ("porch roof", "House roof"),
                ("personal property", "Interior")]


def scope_group(item):
    t = norm(item)
    for k, v in SCOPE_GROUPS:
        if k in t:
            return v
    return str(item or "Other")


def city_of(addr):
    m = re.search(r",?\s*([A-Za-z .'-]+),?\s+([A-Z]{2})\s+\d{5}", addr or "")
    return m.group(1).strip().title() if m else None


ROOF = [("Laminated", r"laminat|architect|dimensional|landmark|timberline"), ("3-tab", r"3[- ]?tab|three[- ]tab|\b2[05] ?yr"),
        ("Wood shake", r"cedar|wood shake"), ("Metal", r"metal roof|standing seam"), ("Slate / tile", r"slate|clay tile|concrete tile")]
SIDING = [("Aluminum / metal", r"alumin\w* sid|metal sid|steel sid"), ("Vinyl", r"vinyl sid"),
          ("Wood", r"wood sid|cedar sid|t1-11|t-111"), ("Fiber cement", r"hardie|fiber cement")]


def material(r, table, default):
    t = " ".join(json.dumps(x, default=str) for x in [
        r.get("roof_details"), r.get("other_details"), r.get("property"),
        g(r, "appraisal_award", "scope"), g(r, "initial_estimate", "scope"), g(r, "reinspection_estimate", "scope")]).lower()
    return next((k for k, p in table if re.search(p, t)), default)


CORE_TRADES = ["House roof", "Garage roof", "Other structure roofs", "Siding", "Gutters & downspouts", "Soffit / fascia",
               "Windows / screens / wraps", "Doors", "Fence / deck / other exterior", "Interior", "Solar D&R"]


def stories_of(r, files_dir):
    """1 or 2 (meaning 2+) from the EagleView report text when on disk, else from the claim notes."""
    for t in glob.glob(os.path.join(files_dir, "*", "*.txt")):
        try:
            m = re.search(r"Number of Stories\s*(>\s*1|<=\s*1|1|2|3)", open(t, errors="ignore").read())
        except OSError:
            m = None
        if m:
            return 2 if m.group(1).replace(" ", "") in (">1", "2", "3") else 1
    t = " ".join(str(x) for x in [g(r, "property", "structures"), r.get("roof_details"), r.get("other_details")]).lower()
    if re.search(r">\s*1 stor|2[- ]stor|two[- ]stor|2-story|multi[- ]stor", t):
        return 2
    if re.search(r"<=\s*1 stor|1[- ]stor|one[- ]stor|single[- ]stor|ranch", t):
        return 1
    return None


def pitch_num(p):
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*/\s*12", str(p or ""))
    return float(m.group(1)) if m else None


def roof_structures(r):
    t = str(g(r, "property", "structures") or "").lower()
    n = len(re.findall(r"structure\s*#?\s*\d", t))
    if not n:
        n = 1 + bool(re.search(r"garage", t)) + bool(re.search(r"shed|gazebo|carport", t))
    return max(1, n)


def carrier_start(r):
    ie = r.get("initial_estimate") or {}
    pre = num(r.get("pre_appraisal_carrier_rcv"))
    net = [num(g(r, k, "net_payment")) for k in ("initial_estimate", "reinspection_estimate")]
    note = " ".join(str(g(r, k, "notes") or "") for k in ("initial_estimate", "reinspection_estimate")).lower()
    if not pre:
        return "Denied"
    if all((v or 0) <= 0 for v in net) or "under deductible" in note or "below deductible" in note:
        return "Under deductible"
    return "Partial payment"


def trade_sets(award_scope, carrier_scope):
    paid = {x["item"] for x in carrier_scope if x["rcv"] > 0}
    awarded = {x["item"] for x in award_scope if x["rcv"] > 0}
    core = lambda s: sorted(t for t in s if t in CORE_TRADES)
    return core(paid), core(awarded), core(awarded - paid)


def profile(d, r, files_dir):
    sq, p = d["squares"], pitch_num(d["pitch"])
    stories, structs = stories_of(r, files_dir), roof_structures(r)
    facets = num(g(r, "property", "facets"))
    paid, awarded, won = trade_sets(d["award_scope"], d["carrier_scope"])
    # trades the carrier's estimate dealt with (paid or $0/denied) = what was in dispute before appraisal
    disputed = sorted({x["item"] for x in d["carrier_scope"] if x["item"] in CORE_TRADES} | set(won))
    score = (p is not None and p >= 8) + (p is not None and p >= 10) + (stories == 2) + (facets is not None and facets >= 20) \
        + (structs >= 2) + (len(disputed) >= 6)
    return {
        "stories": stories, "pitch_num": p, "facets": facets, "roof_structures": structs,
        "wall_sqft": num(g(r, "property", "exterior_wall_sqft")),
        "size": None if not sq else "Small" if sq < 20 else "Medium" if sq < 35 else "Large",
        "complexity_score": int(score),
        "complexity": "Standard" if score <= 1 else "Moderate" if score <= 3 else "Complex",
        "carrier_start": carrier_start(r),
        "trades_carrier_paid": paid, "trades_awarded": awarded, "trades_won": won,
        "trades_in_claim": disputed,
        "days_to_award": (lambda a, b: (a - b).days if a and b else None)(
            *[__import__("datetime").date.fromisoformat(x[:10]) if x and re.match(r"\d{4}-\d\d-\d\d", str(x)) else None
              for x in (d["award_date"], d["date_of_loss"])]),
    }


def row(c, r):
    app = [s for s in c.get("sheet_rows", []) if s.get("type") and "Appraisal" in str(s["type"])]
    award = r.get("appraisal_award") or {}
    pre = num(r.get("pre_appraisal_carrier_rcv"))
    rcv = num(award.get("total_rcv"))
    addr = r.get("address") or c.get("address")
    return {
        "client": c["client"],
        "address": addr,
        "city": city_of(addr),
        "carrier": carrier_group(r.get("carrier") or c.get("insurer")),
        "carrier_full": r.get("carrier") or c.get("insurer"),
        "claim_number": r.get("claim_number"),
        "date_of_loss": r.get("date_of_loss"),
        "cause": cause_group(r.get("cause_of_loss")),
        "project_id": r.get("project_id"),
        "project_status": r.get("project_status"),
        "appraiser": ", ".join(sorted({str(s["appraiser"]) for s in app if s.get("appraiser")})) or None,
        "specialist": ", ".join(sorted({str(s["specialist"]) for s in app if s.get("specialist")})) or None,
        "sheet_umpire": "; ".join(sorted({str(s["umpire"]) for s in app if s.get("umpire")})) or None,
        "result_date": max((str(s["result"])[:10] for s in app if s.get("result")), default=None),
        "sheet_amount": num(sum(num(s.get("amount")) or 0 for s in app)) or None,
        "initial_rcv": num(g(r, "initial_estimate", "rcv")),
        "initial_date": g(r, "initial_estimate", "date"),
        "reinspection_rcv": num(g(r, "reinspection_estimate", "rcv")),
        "reinspection_date": g(r, "reinspection_estimate", "date"),
        "pre_rcv": pre,
        "award_rcv": rcv,
        "award_acv": num(award.get("total_acv")),
        "award_date": award.get("date"),
        "increase": num(r.get("appraisal_increase")),
        "multiple": round(rcv / pre, 2) if rcv and pre and pre > 0 else None,
        "matches_sheet": r.get("sheet_amount_match"),
        "umpire": award.get("umpire"),
        "award_lines": [{"coverage": l.get("coverage"), "rcv": num(l.get("rcv")) or 0, "acv": num(l.get("acv")) or 0}
                        for l in award.get("lines") or []],
        "award_scope": scope(award),
        "carrier_scope": scope(r.get("reinspection_estimate") or r.get("initial_estimate")),
        "scope_summary": str(r.get("scope_summary") or "")[:600],
        "squares": num(g(r, "property", "eagleview_squares")) or num(g(r, "property", "carrier_sketch_squares")),
        "roof_sqft": num(g(r, "property", "eagleview_total_sqft")),
        "pitch": g(r, "property", "predominant_pitch"),
        "structures": str(g(r, "property", "structures") or "")[:300] or None,
        "roof_material": material(r, ROOF, "Unknown"),
        "siding_material": material(r, SIDING, "None / unknown"),
        "confidence": r.get("confidence") or "not processed",
        "issues": [str(i)[:300] for i in (r.get("issues") or [])][:6],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--clients", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    clients = json.load(open(a.clients))
    results = {}
    for p in glob.glob(os.path.join(a.dir, "results", "*.json")):
        try:
            r = json.load(open(p))
            results[str(r["id"])] = r
        except Exception as e:  # noqa: BLE001
            print("BAD", p, e)
    os.makedirs(a.out, exist_ok=True)
    n = 0
    for c in clients:
        r = results.get(str(c["id"]))
        if not r:
            print("missing result:", c["client"])
            continue
        doc_id = hashlib.sha1(norm(c["client"]).encode()).hexdigest()[:12]
        d = row(c, r)
        d.update(profile(d, r, os.path.join(a.dir, "files", str(r["id"]))))
        d["key"] = doc_id
        json.dump(d, open(os.path.join(a.out, doc_id + ".json"), "w"), default=str)
        n += 1
    print(f"wrote {n} dashboard rows to {a.out}")


if __name__ == "__main__":
    main()
