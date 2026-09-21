"""Command line entry point.

    python -m scorecard.cli doctor  export.csv
    python -m scorecard.cli run     export.csv --pdf-dir ./pdfs
    python -m scorecard.cli run     export.csv --pdf-dir ./pdfs --review out/review-queue.csv

`doctor` is read-only and should always be run first. `run` does the whole
pipeline: ingest, extract, apply corrections, score, report.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Dict, List, Optional

import pandas as pd

from . import doctor as doctor_mod
from . import report as report_mod
from . import review as review_mod
from . import scoring
from .config import CONFIG_DIR, Config
from .extract import Extraction, extract_figure, find_pdf
from .ingest import ingest, write_snapshot
from .metrics import compute, exclusion_summary

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SNAPSHOTS = os.path.join(HERE, "snapshots")
DEFAULT_OUT = os.path.join(HERE, "out")


def _extract_all(frame: pd.DataFrame, pdf_dir: Optional[str], quiet: bool) -> pd.DataFrame:
    """Attach extracted figures + provenance to every claim.

    Claims that already carry both CRM fields are skipped entirely — there is
    nothing to gain from parsing a PDF to re-derive a number someone typed.
    """
    out = frame.copy()
    columns = [
        "pre_rcv_extracted", "pre_rcv_confidence", "pre_rcv_reason",
        "pre_rcv_source_file", "pre_rcv_source_page", "pre_rcv_source_line",
        "pre_rcv_candidates",
        "award_rcv_extracted", "award_rcv_confidence", "award_rcv_reason",
        "award_rcv_source_file", "award_rcv_source_page", "award_rcv_source_line",
        "award_rcv_candidates",
    ]
    for column in columns:
        if column not in out:
            out[column] = None

    if out.empty:
        return out

    total = len(out)
    for position, (index, claim) in enumerate(out.iterrows(), start=1):
        if not quiet and (position % 25 == 0 or position == total):
            print(f"  extracting {position}/{total}", file=sys.stderr)

        for field, pdf_column, kind, native in (
            ("pre_rcv", "pre_rcv_pdf", "rcv", "pre_rcv_field"),
            ("award_rcv", "award_pdf", "award", "award_rcv_field"),
        ):
            native_value = claim.get(native)
            if native_value is not None and not pd.isna(native_value) and float(native_value) > 0:
                out.at[index, f"{field}_confidence"] = "crm_field"
                out.at[index, f"{field}_reason"] = "taken from CRM field; PDF not parsed"
                continue

            path = _locate(claim, pdf_column, pdf_dir)
            if not path:
                out.at[index, f"{field}_confidence"] = "none"
                out.at[index, f"{field}_reason"] = (
                    "no source PDF found for this job"
                    if pdf_dir
                    else "no --pdf-dir given and no CRM field"
                )
                continue

            result: Extraction = extract_figure(path, kind)
            out.at[index, f"{field}_extracted"] = result.value
            out.at[index, f"{field}_confidence"] = result.confidence
            out.at[index, f"{field}_reason"] = result.reason
            out.at[index, f"{field}_source_file"] = result.source_file
            out.at[index, f"{field}_source_page"] = result.page
            out.at[index, f"{field}_source_line"] = result.source_line
            # Every amount the parser saw, so a reviewer can tell at a glance
            # whether it was confused or the document genuinely lacks the figure.
            out.at[index, f"{field}_candidates"] = "; ".join(
                f"p{c.page}:{c.amount:,.2f}" for c in result.candidates
            )

    return out


def _locate(claim: pd.Series, pdf_column: str, pdf_dir: Optional[str]) -> Optional[str]:
    """Explicit filename from the export first, then a filename search."""
    named = claim.get(pdf_column)
    if named and not pd.isna(named):
        candidate = str(named)
        if os.path.isabs(candidate) and os.path.exists(candidate):
            return candidate
        if pdf_dir:
            joined = os.path.join(pdf_dir, candidate)
            if os.path.exists(joined):
                return joined
    if pdf_dir:
        return find_pdf(pdf_dir, claim.get("job_id"), claim.get("claim_number"))
    return None


def cmd_doctor(args) -> int:
    cfg = Config.load(args.config_dir)
    result = doctor_mod.run(args.export, cfg)
    if args.json:
        print(json.dumps(report_mod._json_safe(result), indent=2))
    else:
        print(doctor_mod.render(result))
    return 1 if result["missing_required"] else 0


def cmd_run(args) -> int:
    cfg = Config.load(args.config_dir)

    print("1/5 reading export", file=sys.stderr)
    ingested = ingest(args.export, cfg)
    claims: pd.DataFrame = ingested["claims"]
    run_report: Dict = dict(ingested["report"])

    if run_report.get("duplicate_job_id_count"):
        print(
            f"  WARNING: {run_report['duplicate_job_id_count']} duplicate job ids. "
            f"If the export has one row per line item rather than per claim, every "
            f"per-appraiser figure below is double counted. Check before trusting this.",
            file=sys.stderr,
        )

    print("2/5 extracting figures from source documents", file=sys.stderr)
    claims = _extract_all(claims, args.pdf_dir, args.quiet)

    if args.review:
        corrections = review_mod.load_corrections(args.review)
        if corrections:
            print(f"  applying {len(corrections)} human-confirmed claim(s)", file=sys.stderr)
            claims = review_mod.apply_corrections(claims, corrections)

    print("3/5 computing per-claim metrics", file=sys.stderr)
    claims = compute(claims, cfg)

    snapshot = write_snapshot(claims, args.snapshots, args.label)
    print(f"  snapshot frozen at {snapshot}", file=sys.stderr)

    print("4/5 scoring", file=sys.stderr)
    result = scoring.build(claims, cfg)

    usable = int(claims["usable"].astype(bool).sum()) if not claims.empty else 0
    queue = review_mod.build_queue(claims)
    run_report.update(
        {
            "snapshot": snapshot,
            "usable_claims": usable,
            "usable_share": (usable / len(claims)) if len(claims) else None,
            "exclusions": exclusion_summary(claims),
            "review_queue_size": int(len(queue)),
        }
    )

    print("5/5 writing outputs", file=sys.stderr)
    paths = report_mod.write_outputs(result, run_report, args.out)
    queue_path = review_mod.write_queue(queue, os.path.join(args.out, "review-queue.csv"))

    with open(os.path.join(args.out, "run-report.json"), "w", encoding="utf-8") as fh:
        json.dump(report_mod._json_safe(run_report), fh, indent=2)

    print("", file=sys.stderr)
    print(f"  scorecard   {paths['markdown']}", file=sys.stderr)
    print(f"  for Claude  {paths['json']}", file=sys.stderr)
    print(f"  claim rows  {paths['claims']}", file=sys.stderr)
    print(f"  review      {queue_path}  ({len(queue)} rows need a human)", file=sys.stderr)

    if len(queue):
        print("", file=sys.stderr)
        print(
            f"  Next: fill in CONFIRMED_VALUE in the review file, then re-run with\n"
            f"  --review {queue_path}",
            file=sys.stderr,
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="scorecard", description=__doc__)
    parser.add_argument("--config-dir", default=CONFIG_DIR, help="directory holding the *.yml config")
    sub = parser.add_subparsers(dest="command", required=True)

    doc = sub.add_parser("doctor", help="check an export without changing anything")
    doc.add_argument("export")
    doc.add_argument("--json", action="store_true")
    doc.set_defaults(func=cmd_doctor)

    run = sub.add_parser("run", help="run the full pipeline")
    run.add_argument("export")
    run.add_argument("--pdf-dir", default=None, help="folder holding the estimate and award PDFs")
    run.add_argument("--review", default=None, help="a filled-in review-queue.csv to apply")
    run.add_argument("--out", default=DEFAULT_OUT)
    run.add_argument("--snapshots", default=DEFAULT_SNAPSHOTS)
    run.add_argument("--label", default=None, help="snapshot label (defaults to a timestamp)")
    run.add_argument("--quiet", action="store_true")
    run.set_defaults(func=cmd_run)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
