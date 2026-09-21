"""Generate a synthetic dataset with KNOWN ground truth.

The point is not to have something to look at. It is that the appraiser effects,
the carrier and trade confounders, and the assignment bias are all planted
deliberately, so the tests can assert that the pipeline recovers what was put in
— and, just as important, that it refuses to rank the appraiser who only has a
handful of claims.

    python tests/make_fixtures.py --out /tmp/fixtures --claims 240

Requires reportlab (dev-only; not needed to run the pipeline).
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import os
import random
from typing import Dict, List

# Planted per-appraiser effects, in percentage points of net increase on top of
# whatever the claim's own characteristics justify.
APPRAISER_EFFECTS: Dict[str, float] = {
    "Dana Whitfield": 0.070,
    "Marcus Reed": 0.035,
    "Priya Raman": 0.000,
    "Tom Delgado": 0.000,
    "Susan Okafor": -0.045,
    "Gil Hanley": 0.060,   # strong, but deliberately given too few claims to rank
}

# How carrier names appear in the wild. Multiple spellings on purpose.
CARRIER_VARIANTS = {
    "State Farm": ["State Farm", "STATE FARM", "St. Farm", "State Farm Ins Co"],
    "Allstate": ["Allstate", "All State", "ALLSTATE INSURANCE"],
    "USAA": ["USAA", "U.S.A.A."],
    "Travelers": ["Travelers", "Travellers"],
    "Liberty Mutual": ["Liberty Mutual", "Liberty Mutual Insurance"],
    "Citizens": ["Citizens Property Insurance"],
}
CARRIER_EFFECT = {
    "State Farm": 0.06, "Allstate": 0.12, "USAA": 0.04,
    "Travelers": 0.09, "Liberty Mutual": 0.14, "Citizens": 0.18,
}

TRADE_VARIANTS = {
    "Roofing": ["Roof", "Roofing", "Re-roof"],
    "Siding": ["Siding"],
    "Interior": ["Interior", "Int"],
    "Full Exterior": ["Full Exterior", "Exterior"],
}
TRADE_EFFECT = {"Roofing": 0.05, "Siding": 0.09, "Interior": 0.15, "Full Exterior": 0.08}

MATERIALS = {
    "Roofing": ["Architectural", "3-Tab", "Tile", "Metal"],
    "Siding": ["Composition"],
    "Interior": ["Composition"],
    "Full Exterior": ["Architectural", "Tile"],
}

ESTIMATE_TEMPLATE = """\
                    PROPERTY DAMAGE ESTIMATE - SUMMARY

Insured: {customer}
Claim Number: {claim}
Date of Loss: {dol}
Carrier: {carrier}
Price List: {pricelist}

------------------------------------------------------------------
SUMMARY FOR DWELLING
------------------------------------------------------------------
Line Item Total                                    {subtotal:>14}
Material Sales Tax                                 {tax:>14}
Overhead and Profit (20%)                          {op:>14}

Replacement Cost Value                             {rcv:>14}
Less Depreciation                                 {depreciation:>14}
Actual Cash Value                                  {acv:>14}
Less Deductible                                   {deductible:>14}
Net Claim                                          {net:>14}
"""

AWARD_TEMPLATE = """\
                        APPRAISAL AWARD

Claim Number: {claim}
Insured: {customer}
Carrier: {carrier}
Date of Award: {award_date}

The undersigned, having been appointed as appraisers, have determined
the amount of loss for the above-referenced claim as follows:

Total Award                                        {award:>14}
Less Deductible                                   {deductible:>14}

Appraiser for the Insured: {appraiser}
Appraiser for the Carrier: R. Vance
Umpire: {umpire}
"""

# A revised estimate stapled to the original in one file. The extractor MUST
# refuse this rather than pick one, which is what the review queue is for.
CONFLICTED_TEMPLATE = """\
                    PROPERTY DAMAGE ESTIMATE - SUMMARY

Claim Number: {claim}

--- ORIGINAL ---
Replacement Cost Value                             {rcv_a:>14}

--- REVISED 11/04 ---
Replacement Cost Value                             {rcv_b:>14}
"""


def money(value: float) -> str:
    return f"${value:,.2f}"


def neg_money(value: float) -> str:
    return f"(${abs(value):,.2f})"


def write_pdf(path: str, text: str, blank: bool = False) -> None:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    pdf = canvas.Canvas(path, pagesize=letter)
    if blank:
        # A scan: pixels, no text layer. Must be detected, never guessed at.
        pdf.rect(72, 500, 400, 200, stroke=1, fill=0)
    else:
        pdf.setFont("Courier", 9)
        y = 740
        for line in text.splitlines():
            pdf.drawString(54, y, line)
            y -= 11
            if y < 54:
                pdf.showPage()
                pdf.setFont("Courier", 9)
                y = 740
    pdf.save()


def generate(out_dir: str, n_claims: int, seed: int = 7) -> Dict[str, object]:
    rng = random.Random(seed)
    pdf_dir = os.path.join(out_dir, "pdfs")
    os.makedirs(pdf_dir, exist_ok=True)

    names = list(APPRAISER_EFFECTS)
    # Weighted so Gil Hanley stays below the ranking threshold, and Dana gets the
    # lion's share of one carrier — the assignment bias the diagnostic must catch.
    weights = [0.24, 0.20, 0.20, 0.18, 0.15, 0.03]

    rows: List[Dict[str, object]] = []
    truth: List[Dict[str, object]] = []

    for i in range(n_claims):
        job_id = f"J{10000 + i}"
        claim_no = f"CL-{rng.randint(100000, 999999)}"
        appraiser = rng.choices(names, weights=weights, k=1)[0]

        if appraiser == "Dana Whitfield" and rng.random() < 0.75:
            carrier = "State Farm"          # planted concentration
        else:
            carrier = rng.choice(list(CARRIER_VARIANTS))

        trade = rng.choice(list(TRADE_VARIANTS))
        material = rng.choice(MATERIALS[trade])

        # Dana also gets systematically larger claims.
        size_mu = 10.9 if appraiser == "Dana Whitfield" else 10.4
        pre_rcv = round(min(400000, max(4000, rng.lognormvariate(size_mu, 0.55))), 2)

        expected = CARRIER_EFFECT[carrier] + TRADE_EFFECT[trade]
        expected += -0.03 if pre_rcv > 60000 else 0.01      # big claims increase less, proportionally
        expected += 0.04 if material in {"Tile", "Metal"} else 0.0

        gross_pct = max(-0.05, expected + APPRAISER_EFFECTS[appraiser] + rng.gauss(0, 0.05))
        award = round(pre_rcv * (1 + gross_pct), 2)

        invoked = dt.date(2024, 1, 1) + dt.timedelta(days=rng.randint(0, 600))
        cycle = max(20, int(rng.gauss(95, 35)))
        award_date = invoked + dt.timedelta(days=cycle)
        umpire = rng.random() < 0.18
        fee = round((award - pre_rcv) * 0.10, 2)

        # Deliberate data-quality defects, at roughly the rate a real export has.
        defect = rng.random()
        conflicted = defect < 0.05
        scanned = 0.05 <= defect < 0.09
        missing_award = 0.09 <= defect < 0.12

        deductible = 2500.0
        depreciation = round(pre_rcv * 0.18, 2)
        subtotal = round(pre_rcv / 1.28, 2)

        est_path = os.path.join(pdf_dir, f"{job_id}_estimate.pdf")
        if conflicted:
            write_pdf(est_path, CONFLICTED_TEMPLATE.format(
                claim=claim_no, rcv_a=money(pre_rcv), rcv_b=money(pre_rcv * 1.07)))
        elif scanned:
            write_pdf(est_path, "", blank=True)
        else:
            write_pdf(est_path, ESTIMATE_TEMPLATE.format(
                customer=f"Homeowner {i}", claim=claim_no, dol=invoked.isoformat(),
                carrier=carrier, pricelist=f"TXDA8X_{invoked:%b%y}".upper(),
                subtotal=money(subtotal), tax=money(round(subtotal * 0.05, 2)),
                op=money(round(subtotal * 0.20, 2)), rcv=money(pre_rcv),
                depreciation=neg_money(depreciation),
                acv=money(round(pre_rcv - depreciation, 2)),
                deductible=neg_money(deductible),
                net=money(round(pre_rcv - depreciation - deductible, 2))))

        award_path = os.path.join(pdf_dir, f"{job_id}_award.pdf")
        if not missing_award:
            write_pdf(award_path, AWARD_TEMPLATE.format(
                claim=claim_no, customer=f"Homeowner {i}", carrier=carrier,
                award_date=award_date.isoformat(), award=money(award),
                deductible=neg_money(deductible), appraiser=appraiser,
                umpire="M. Foster" if umpire else "N/A"))

        rows.append({
            "Job ID": job_id,
            "Claim #": claim_no,
            "Customer Name": f"Homeowner {i}",
            "Insurance Company": rng.choice(CARRIER_VARIANTS[carrier]),
            "Trade": rng.choice(TRADE_VARIANTS[trade]),
            "Roof Material": material,
            "Appraiser": appraiser if rng.random() > 0.15
                         else f"{appraiser.split()[1]}, {appraiser.split()[0]}",
            "State": rng.choice(["TX", "OK", "FL", "CO"]),
            "Date of Loss": invoked.isoformat(),
            "Appraisal Invoked": invoked.isoformat(),
            "Award Date": award_date.isoformat(),
            "Umpire Used": "Yes" if umpire else "No",
            "Appraiser Fee": f"{fee:.2f}",
            "Carrier Estimate File": os.path.basename(est_path),
            "Award File": os.path.basename(award_path) if not missing_award else "",
        })
        truth.append({
            "job_id": job_id, "appraiser": appraiser, "carrier": carrier,
            "trade": trade, "pre_rcv": pre_rcv, "award": award,
            "gross_pct": gross_pct, "defect":
                "conflicted" if conflicted else "scanned" if scanned
                else "missing_award" if missing_award else "",
        })

    export_path = os.path.join(out_dir, "export.csv")
    with open(export_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    truth_path = os.path.join(out_dir, "ground-truth.csv")
    with open(truth_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(truth[0]))
        writer.writeheader()
        writer.writerows(truth)

    return {"export": export_path, "pdf_dir": pdf_dir, "truth": truth_path,
            "effects": APPRAISER_EFFECTS}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--claims", type=int, default=240)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    result = generate(args.out, args.claims, args.seed)
    print(f"export:  {result['export']}")
    print(f"pdfs:    {result['pdf_dir']}")
    print(f"truth:   {result['truth']}")
    print("planted effects:")
    for name, effect in result["effects"].items():
        print(f"  {name:<20} {effect:+.1%}")
