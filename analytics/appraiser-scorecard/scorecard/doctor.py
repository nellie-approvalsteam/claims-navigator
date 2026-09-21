"""Pre-flight check on a real export.

Run this first, always. It answers "will this pipeline work on my data, and what
do I have to fix" in one pass, instead of finding out three steps in. It reads
the export and reports what mapped, what did not, and what that will cost you —
it never writes anything.
"""

from __future__ import annotations

from typing import Dict, List

import pandas as pd

from .config import Config
from .ingest import read_export
from .normalize import build_normalizers, normalize_person, resolve_columns

# Fields whose absence materially weakens the analysis, and what it costs.
IMPORTANT = {
    "trade_raw": "cannot control for trade — comparisons get coarser",
    "material_raw": "cannot control for material",
    "appraisal_invoked_date": "no cycle-time measure",
    "award_date": "no cycle-time measure",
    "umpire_used": "no umpire rate; umpire costs fall back to config defaults",
    "appraiser_fee": "net-of-fee figures fall back to the config fee model",
}


def run(export_path: str, cfg: Config) -> Dict[str, object]:
    raw = read_export(export_path)
    headers = list(raw.columns)
    resolved = resolve_columns(headers, cfg.all_columns)

    missing_required = [k for k in cfg.required_columns if not resolved.get(k)]
    missing_important = [k for k in IMPORTANT if not resolved.get(k)]

    findings: List[str] = []
    normalization: List[Dict] = []
    appraiser_counts: Dict[str, int] = {}

    if not missing_required:
        normalizers = build_normalizers(cfg)
        for key, norm_key in (("carrier_raw", "carrier"), ("trade_raw", "trade"), ("material_raw", "material")):
            header = resolved.get(key)
            if not header:
                continue
            for value in raw[header]:
                normalizers[norm_key].normalize(value)
        normalization = [n.report() for n in normalizers.values() if n.unmapped or n.ambiguous]

        appraiser_header = resolved["appraiser_raw"]
        names = [normalize_person(v) for v in raw[appraiser_header]]
        counts = pd.Series([n for n in names if n]).value_counts()
        appraiser_counts = {str(k): int(v) for k, v in counts.items()}

    # --- What the volume will actually support.
    min_claims = int(cfg.get("scoring", "min_claims_to_rank", default=8))
    rankable = [a for a, n in appraiser_counts.items() if n >= min_claims]

    if appraiser_counts:
        if len(rankable) < 2:
            findings.append(
                f"Only {len(rankable)} appraiser(s) have the {min_claims}+ claims needed "
                f"to be ranked. Even with perfect extraction this export cannot produce "
                f"a comparison. Widen the date range or lower min_claims_to_rank — and "
                f"if you lower it, say so when presenting the result."
            )
        else:
            findings.append(
                f"{len(rankable)} of {len(appraiser_counts)} appraisers clear the "
                f"{min_claims}-claim bar. Expect a ranking over those, with the rest "
                f"listed as insufficient data."
            )

        # Claim counts here are BEFORE extraction losses, which is the number that
        # actually matters and the one people are always surprised by.
        total = sum(appraiser_counts.values())
        findings.append(
            f"{total} claims have an appraiser. Extraction will lose some of these — "
            f"plan on the review queue, not on a clean run."
        )

    has_native = bool(resolved.get("pre_rcv_field") and resolved.get("award_rcv_field"))
    if has_native:
        findings.append(
            "Export carries both dollar figures as fields. PDF extraction will be "
            "skipped where they are populated — this is the reliable path."
        )
    else:
        findings.append(
            "No dollar-figure fields found, so both numbers come from PDFs. This is "
            "the main source of data loss and the thing worth fixing at the source "
            "(see README, 'Fixing this at the source')."
        )

    return {
        "export_path": export_path,
        "rows": int(len(raw)),
        "headers": headers,
        "mapped": {k: v for k, v in resolved.items() if v},
        "missing_required": missing_required,
        "missing_important": {k: IMPORTANT[k] for k in missing_important},
        "unmapped_values": normalization,
        "appraiser_counts": appraiser_counts,
        "rankable_appraisers": rankable,
        "findings": findings,
    }


def render(result: Dict[str, object]) -> str:
    lines: List[str] = []
    lines.append(f"Export:  {result['export_path']}")
    lines.append(f"Rows:    {result['rows']}")
    lines.append("")

    mapped = result["mapped"]
    lines.append(f"MAPPED COLUMNS ({len(mapped)})")
    for canonical, header in sorted(mapped.items()):
        lines.append(f"  {canonical:<26} <- {header!r}")
    lines.append("")

    if result["missing_required"]:
        lines.append("MISSING — REQUIRED (the pipeline cannot run)")
        for key in result["missing_required"]:
            lines.append(f"  {key}")
        lines.append("  Fix: add your real header name to config/columns.yml under 'required'.")
        lines.append("")

    if result["missing_important"]:
        lines.append("MISSING — DEGRADES THE ANALYSIS")
        for key, cost in result["missing_important"].items():
            lines.append(f"  {key:<26} {cost}")
        lines.append("")

    for norm in result["unmapped_values"]:
        values = norm.get("unmapped_values") or []
        if values:
            lines.append(f"UNMAPPED {norm['field'].upper()} VALUES ({norm.get('unmapped_total_rows', 0)} rows)")
            for value, count in values[:20]:
                lines.append(f"  {count:>4}x  {value!r}")
            lines.append("  Fix: add these to the matching config file. Unmapped values are excluded.")
            lines.append("")
        ambiguous = norm.get("ambiguous_values") or {}
        if ambiguous:
            lines.append(f"AMBIGUOUS {norm['field'].upper()} VALUES (matched 2+ canonical names)")
            for value, hits in list(ambiguous.items())[:10]:
                lines.append(f"  {value!r} -> {hits}")
            lines.append("")

    counts = result["appraiser_counts"]
    if counts:
        min_shown = 25
        lines.append(f"APPRAISERS ({len(counts)})")
        for name, n in list(counts.items())[:min_shown]:
            mark = "rankable" if name in result["rankable_appraisers"] else "too few"
            lines.append(f"  {n:>4}  {name:<30} {mark}")
        if len(counts) > min_shown:
            lines.append(f"  ... and {len(counts) - min_shown} more")
        lines.append("")
        lines.append(
            "  Check this list for the same person spelled two ways — a split name "
            "halves both counts and is easy to miss."
        )
        lines.append("")

    lines.append("ASSESSMENT")
    for finding in result["findings"]:
        lines.append(f"  - {finding}")
    return "\n".join(lines)
