"""Contractors Cloud CSV export -> a frozen, normalised snapshot.

Two things matter here.

First, SNAPSHOTS ARE FROZEN. Every run writes a dated file and all downstream
work reads that file, never the export again. Re-querying live data mid-analysis
is how two runs a week apart produce different numbers for the same closed claim
and nobody can say which was right.

Second, NOTHING IS DROPPED SILENTLY. Rows that cannot be used are kept with an
exclusion reason attached, and the reasons are counted in the run report.
"""

from __future__ import annotations

import datetime as dt
import os
from typing import Dict, List, Optional

import pandas as pd

from .config import Config
from .normalize import build_normalizers, normalize_person, resolve_columns

TRUTHY = {"y", "yes", "true", "t", "1", "x", "umpire", "used"}
FALSY = {"n", "no", "false", "f", "0", "", "none", "na", "n/a"}


def _to_bool(value: object) -> Optional[bool]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip().lower()
    if text in TRUTHY:
        return True
    if text in FALSY:
        return False
    return None


def _to_float(value: object) -> Optional[float]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip().replace("$", "").replace(",", "")
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text.strip("()")
    if not text or text.lower() in {"na", "n/a", "none", "-"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _to_date(value: object) -> Optional[dt.date]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"na", "n/a", "none"}:
        return None
    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def read_export(path: str) -> pd.DataFrame:
    """Read the export as raw strings — pandas type inference mangles claim
    numbers with leading zeros and turns job ids into floats."""
    if path.lower().endswith((".xlsx", ".xlsm")):
        return pd.read_excel(path, dtype=str)
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return pd.read_csv(path, dtype=str, encoding=encoding, keep_default_na=False)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Could not decode {path} as UTF-8 or Latin-1")


def ingest(export_path: str, cfg: Config) -> Dict[str, object]:
    """Normalise an export into the canonical claim table."""
    raw = read_export(export_path)
    headers = list(raw.columns)

    resolved = resolve_columns(headers, cfg.all_columns)
    missing_required = [k for k in cfg.required_columns if not resolved.get(k)]
    if missing_required:
        raise ValueError(
            "Export is missing required columns: "
            + ", ".join(missing_required)
            + ".\nRun `doctor` on this file to see which headers were found, then "
            "add your real header names to config/columns.yml."
        )

    normalizers = build_normalizers(cfg)

    def column(row, key):
        header = resolved.get(key)
        if not header:
            return None
        value = row.get(header)
        if isinstance(value, str) and not value.strip():
            return None
        return value

    records: List[Dict[str, object]] = []
    for _, row in raw.iterrows():
        carrier_raw = column(row, "carrier_raw")
        trade_raw = column(row, "trade_raw")
        material_raw = column(row, "material_raw")
        appraiser_raw = column(row, "appraiser_raw")

        record: Dict[str, object] = {
            "job_id": str(column(row, "job_id") or "").strip(),
            "claim_number": str(column(row, "claim_number") or "").strip(),
            "customer_name": str(column(row, "customer_name") or "").strip(),
            "carrier_raw": carrier_raw,
            "carrier": normalizers["carrier"].normalize(carrier_raw),
            "trade_raw": trade_raw,
            "trade": normalizers["trade"].normalize(trade_raw),
            "material_raw": material_raw,
            "material": normalizers["material"].normalize(material_raw),
            "appraiser_raw": appraiser_raw,
            "appraiser": normalize_person(appraiser_raw),
            "state": str(column(row, "state") or "").strip(),
            "home_size_sqft": _to_float(column(row, "home_size_sqft")),
            "roof_squares": _to_float(column(row, "roof_squares")),
            "date_of_loss": _to_date(column(row, "date_of_loss")),
            "appraisal_invoked_date": _to_date(column(row, "appraisal_invoked_date")),
            "award_date": _to_date(column(row, "award_date")),
            "umpire_used": _to_bool(column(row, "umpire_used")),
            "appraiser_fee": _to_float(column(row, "appraiser_fee")),
            "umpire_fee": _to_float(column(row, "umpire_fee")),
            "pre_rcv_field": _to_float(column(row, "pre_rcv_field")),
            "award_rcv_field": _to_float(column(row, "award_rcv_field")),
            "pre_rcv_pdf": (str(column(row, "pre_rcv_pdf") or "").strip() or None),
            "award_pdf": (str(column(row, "award_pdf") or "").strip() or None),
        }
        records.append(record)

    frame = pd.DataFrame.from_records(records)

    # Duplicate job ids mean the export has one row per something-else (a payment,
    # a trade line). Silently averaging over them double-counts appraisers.
    duplicate_ids: List[str] = []
    if not frame.empty:
        counts = frame["job_id"].value_counts()
        duplicate_ids = [str(k) for k, v in counts.items() if v > 1 and str(k)]

    report = {
        "export_path": os.path.abspath(export_path),
        "rows_in": int(len(raw)),
        "headers_found": {k: v for k, v in resolved.items() if v},
        "headers_missing": [k for k, v in resolved.items() if not v],
        "duplicate_job_ids": duplicate_ids[:50],
        "duplicate_job_id_count": len(duplicate_ids),
        "normalization": [n.report() for n in normalizers.values()],
        "has_native_amount_fields": bool(
            resolved.get("pre_rcv_field") and resolved.get("award_rcv_field")
        ),
    }
    return {"claims": frame, "report": report}


def write_snapshot(frame: pd.DataFrame, snapshot_dir: str, label: str | None = None) -> str:
    os.makedirs(snapshot_dir, exist_ok=True)
    stamp = label or dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = os.path.join(snapshot_dir, f"claims-{stamp}.csv")
    frame.to_csv(path, index=False)
    return path


def latest_snapshot(snapshot_dir: str) -> Optional[str]:
    if not os.path.isdir(snapshot_dir):
        return None
    files = sorted(f for f in os.listdir(snapshot_dir) if f.startswith("claims-") and f.endswith(".csv"))
    return os.path.join(snapshot_dir, files[-1]) if files else None
