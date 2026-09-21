"""The human review queue.

Anything the extractor refused to decide lands here as a spreadsheet with the
provenance attached: which file, which page, which line it was looking at, and
what the competing candidates were. A person fills in two columns and the next
run picks the answers up.

Corrections are keyed by job id and stored separately from the snapshot, so they
survive re-exports and accumulate. Confirming a figure once should never have to
happen twice.
"""

from __future__ import annotations

import csv
import os
from typing import Dict, List, Optional

import pandas as pd

REVIEW_COLUMNS = [
    "job_id",
    "claim_number",
    "customer_name",
    "carrier_raw",
    "appraiser",
    "field",            # pre_rcv | award_rcv
    "reason",
    "source_file",
    "source_page",
    "source_line",
    "candidates_seen",
    "auto_value",
    "CONFIRMED_VALUE",  # <- the human fills this in
    "REVIEWER_NOTE",
]


def build_queue(frame: pd.DataFrame) -> pd.DataFrame:
    """One row per (claim, missing figure) needing a decision."""
    rows: List[Dict[str, object]] = []
    if frame.empty:
        return pd.DataFrame(columns=REVIEW_COLUMNS)

    for _, claim in frame.iterrows():
        if not bool(claim.get("needs_review")):
            continue

        for field, prefix in (("pre_rcv", "pre_rcv"), ("award_rcv", "award_rcv")):
            resolved = claim.get(field)
            if resolved is not None and not pd.isna(resolved):
                continue

            candidates = claim.get(f"{prefix}_candidates") or ""
            rows.append(
                {
                    "job_id": claim.get("job_id"),
                    "claim_number": claim.get("claim_number"),
                    "customer_name": claim.get("customer_name"),
                    "carrier_raw": claim.get("carrier_raw"),
                    "appraiser": claim.get("appraiser"),
                    "field": field,
                    "reason": claim.get(f"{prefix}_reason") or claim.get("exclusion_reason"),
                    "source_file": claim.get(f"{prefix}_source_file"),
                    "source_page": claim.get(f"{prefix}_source_page"),
                    "source_line": claim.get(f"{prefix}_source_line"),
                    "candidates_seen": candidates,
                    "auto_value": claim.get(f"{prefix}_extracted"),
                    "CONFIRMED_VALUE": "",
                    "REVIEWER_NOTE": "",
                }
            )

    return pd.DataFrame(rows, columns=REVIEW_COLUMNS)


def write_queue(queue: pd.DataFrame, path: str) -> str:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    queue.to_csv(path, index=False, quoting=csv.QUOTE_MINIMAL)
    return path


def load_corrections(path: Optional[str]) -> Dict[str, Dict[str, float]]:
    """Read a filled-in review file: {job_id: {field: value}}.

    Rows with a blank CONFIRMED_VALUE are skipped — a reviewer working through
    the queue over several sittings should be able to save halfway.
    """
    corrections: Dict[str, Dict[str, float]] = {}
    if not path or not os.path.exists(path):
        return corrections

    frame = pd.read_csv(path, dtype=str, keep_default_na=False)
    for _, row in frame.iterrows():
        raw = str(row.get("CONFIRMED_VALUE", "")).strip()
        if not raw:
            continue
        cleaned = raw.replace("$", "").replace(",", "").strip()
        try:
            value = float(cleaned)
        except ValueError:
            continue
        if value <= 0:
            continue

        job_id = str(row.get("job_id", "")).strip()
        field = str(row.get("field", "")).strip()
        if job_id and field in {"pre_rcv", "award_rcv"}:
            corrections.setdefault(job_id, {})[field] = value

    return corrections


def apply_corrections(frame: pd.DataFrame, corrections: Dict[str, Dict[str, float]]) -> pd.DataFrame:
    """Overlay human-confirmed figures onto the extracted ones.

    Confirmed values are written into the *_extracted columns with confidence
    'confirmed', which outranks every automatic level — a person who opened the
    PDF wins over the parser, always.
    """
    out = frame.copy()
    if out.empty or not corrections:
        return out

    for index, claim in out.iterrows():
        job_corrections = corrections.get(str(claim.get("job_id", "")).strip())
        if not job_corrections:
            continue
        for field, value in job_corrections.items():
            prefix = field
            out.at[index, f"{prefix}_extracted"] = value
            out.at[index, f"{prefix}_confidence"] = "confirmed"
            out.at[index, f"{prefix}_reason"] = "human confirmed from source document"
    return out
