"""Rendering the scorecard.

Two outputs, on purpose:

  scorecard.md   - for people. Leads with data quality, then tiers, then the
                   caveats, because the caveats are what stop this being misused.
  scorecard.json - for Claude. Small, already-computed, one row per appraiser.

The JSON is deliberately a summary, never the claim rows. Handing a model
hundreds of records and asking who is best reintroduces exactly the arithmetic
drift this pipeline exists to remove. The model's job is to interpret a computed
table, not to compute.
"""

from __future__ import annotations

import datetime as dt
import json
import os
from typing import Dict, List, Optional

import numpy as np
import pandas as pd


def _pct(value: Optional[float], digits: int = 1) -> str:
    if value is None or (isinstance(value, float) and (pd.isna(value) or np.isinf(value))):
        return "—"
    return f"{value * 100:.{digits}f}%"


def _usd(value: Optional[float]) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "—"
    return f"${value:,.0f}"


def _num(value: Optional[float], digits: int = 0) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "—"
    return f"{value:,.{digits}f}"


def _json_safe(value):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if np.isnan(value) else float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (dt.date, dt.datetime, pd.Timestamp)):
        return str(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, float) and pd.isna(value):
        return None
    return value


def render_markdown(result: Dict, run_report: Dict) -> str:
    target = result.get("target_metric", "net_increase_pct")
    ranked: List[Dict] = result.get("ranked", [])
    unranked: List[Dict] = result.get("unranked", [])
    bias: List[Dict] = result.get("bias_diagnostics", [])
    level = result.get("confidence_level", 0.90)

    lines: List[str] = []
    lines.append("# Appraiser Increase Scorecard")
    lines.append("")
    lines.append(f"Generated {dt.datetime.now():%Y-%m-%d %H:%M} · ranking metric: `{target}`")
    lines.append("")

    # --- Data quality first. If this section looks bad, nothing below is usable.
    lines.append("## 1. Data quality")
    lines.append("")
    lines.append("Read this before the rankings. Everything below inherits these limits.")
    lines.append("")
    lines.append(f"- Claims in export: **{run_report.get('rows_in', 0)}**")
    lines.append(f"- Claims usable in scorecard: **{run_report.get('usable_claims', 0)}**")

    usable_share = run_report.get("usable_share")
    if usable_share is not None:
        lines.append(f"- Usable share: **{_pct(usable_share)}**")
        if usable_share < 0.7:
            lines.append("")
            lines.append(
                f"> **Under 70% of claims are usable.** Treat every number below as "
                f"provisional. If the unusable claims are not randomly distributed "
                f"across appraisers — check §5 — the ranking is biased, not just noisy."
            )
    lines.append(f"- Awaiting human review: **{run_report.get('review_queue_size', 0)}**")
    lines.append("")

    exclusions = run_report.get("exclusions") or []
    if exclusions:
        lines.append("**Why claims were excluded**")
        lines.append("")
        lines.append("| Reason | Claims | Share |")
        lines.append("|---|---:|---:|")
        for row in exclusions:
            lines.append(f"| {row['reason']} | {row['claims']} | {_pct(row['share_of_all'])} |")
        lines.append("")

    for norm in run_report.get("normalization", []) or []:
        unmapped = norm.get("unmapped_values") or []
        if unmapped:
            total = norm.get("unmapped_total_rows", 0)
            lines.append(
                f"**Unmapped {norm['field']} values ({total} rows)** — add these to "
                f"`config/{'carriers' if norm['field'] == 'carrier' else 'trades'}.yml`:"
            )
            lines.append("")
            for value, count in unmapped[:15]:
                lines.append(f"- `{value}` ({count})")
            lines.append("")

    # --- The ranking.
    lines.append("## 2. Ranking")
    lines.append("")

    if not ranked:
        lines.append(f"**No ranking produced.** {result.get('note', '')}")
        lines.append("")
    else:
        if not result.get("separable", False):
            lines.append(f"> **{result.get('note', '')}**")
            lines.append("")

        lines.append(
            f"`adjusted` is how far above or below the expected result for that "
            f"*kind of claim* each appraiser lands, after shrinkage. "
            f"Interval is {level:.0%}, cluster bootstrap. "
            f"**Appraisers sharing a tier are not distinguishable by this data.**"
        )
        lines.append("")
        lines.append("| Tier | Appraiser | Claims | Adjusted | Interval | Raw | Mean gross | Median days | Umpire |")
        lines.append("|---:|---|---:|---:|---|---:|---:|---:|---:|")
        for row in ranked:
            interval = f"{_pct(row['ci_low'])} … {_pct(row['ci_high'])}"
            star = " ✱" if row.get("ci_excludes_zero") else ""
            lines.append(
                f"| {row['tier']} | {row['appraiser']}{star} | {row['usable_claims']} | "
                f"**{_pct(row['adjusted_effect'])}** | {interval} | "
                f"{_pct(row['raw_effect'])} | {_pct(row.get('mean_increase_pct'))} | "
                f"{_num(row.get('median_cycle_days'))} | {_pct(row.get('umpire_rate'), 0)} |"
            )
        lines.append("")
        lines.append("✱ = interval excludes zero, i.e. this appraiser differs from the roster average by more than sampling noise.")
        lines.append("")

        shrunk_hard = [r for r in ranked if r["shrinkage_weight"] < 0.5]
        if shrunk_hard:
            names = ", ".join(r["appraiser"] for r in shrunk_hard)
            lines.append(
                f"> Heavily shrunk toward the average (under 50% weight on their own "
                f"data): **{names}**. Their adjusted figure is dominated by the roster "
                f"average, not by their record. More claims would move it."
            )
            lines.append("")

    if unranked:
        lines.append("### Not ranked — insufficient data")
        lines.append("")
        lines.append("Below the claim threshold to be scored. Shown for completeness; do not rank on these.")
        lines.append("")
        lines.append("| Appraiser | Total | Usable | Mean gross | Mean net | Total net $ |")
        lines.append("|---|---:|---:|---:|---:|---:|")
        for row in unranked:
            lines.append(
                f"| {row['appraiser']} | {row['claims_total']} | {row['claims_usable']} | "
                f"{_pct(row.get('mean_increase_pct'))} | {_pct(row.get('mean_net_increase_pct'))} | "
                f"{_usd(row.get('total_net_increase_usd'))} |"
            )
        lines.append("")

    # --- Comparability.
    lines.append("## 3. Is this a fair comparison?")
    lines.append("")
    flagged = [b for b in bias if b.get("flags")]
    if not flagged:
        lines.append("No caseload-composition problems detected. Comparisons look reasonably apples-to-apples.")
        lines.append("")
    else:
        lines.append(
            "These appraisers do not receive a representative mix of claims. "
            "Their scores are adjusted for carrier, trade and size, but adjustment "
            "cannot fully rescue a comparison where the caseloads barely overlap."
        )
        lines.append("")
        for row in flagged:
            lines.append(f"**{row['appraiser']}** ({row['claims']} claims)")
            for flag in row["flags"]:
                lines.append(f"- {flag}")
            lines.append("")

    # --- How the comparison was actually made.
    lines.append("## 4. How claims were compared")
    lines.append("")
    accounting = result.get("stratum_accounting") or []
    if accounting:
        total = sum(a["claims_resolved"] for a in accounting) or 1
        lines.append("| Comparison detail | Claims | Share |")
        lines.append("|---|---:|---:|")
        for row in accounting:
            lines.append(
                f"| {row['level']} | {row['claims_resolved']} | "
                f"{_pct(row['claims_resolved'] / total)} |"
            )
        lines.append("")
        coarse = sum(a["claims_resolved"] for a in accounting if a["level"] in {"size", "all"})
        if coarse / total > 0.4:
            lines.append(
                f"> **{_pct(coarse / total)} of claims were compared at a coarse level "
                f"only** (size alone, or no controls). Carrier and trade are not "
                f"meaningfully controlled for those claims. More history is the only fix."
            )
            lines.append("")

    # --- Standing caveats.
    lines.append("## 5. What this does not tell you")
    lines.append("")
    lines.append(
        "- **Assignment is not random.** If specialists route harder claims to a "
        "particular appraiser, that appraiser's adjusted score is understated, and "
        "no statistical control fully fixes it. Compare §3 against how assignment "
        "actually happens."
    )
    lines.append(
        "- **Increase is not the only thing you buy.** Cycle time and umpire rate "
        "are in the table. An appraiser who nets 2 points less in half the time may "
        "be the better choice."
    )
    lines.append(
        "- **Survivorship.** Claims that settled before an award, or were abandoned, "
        "are not here. An appraiser who walks away from weak claims looks better than "
        "one who sees them through."
    )
    lines.append(
        "- **Price list drift.** Part of any increase comes from Xactimate price "
        "list updates between the carrier estimate and the award, not from the "
        "appraiser. This affects long-cycle claims most."
    )
    lines.append("")
    return "\n".join(lines)


def render_json(result: Dict, run_report: Dict) -> Dict:
    """The compact object to hand to Claude for interpretation."""
    return _json_safe(
        {
            "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
            "target_metric": result.get("target_metric"),
            "confidence_level": result.get("confidence_level"),
            "separable": result.get("separable", False),
            "note": result.get("note", ""),
            "data_quality": {
                "rows_in": run_report.get("rows_in"),
                "usable_claims": run_report.get("usable_claims"),
                "usable_share": run_report.get("usable_share"),
                "review_queue_size": run_report.get("review_queue_size"),
                "exclusions": run_report.get("exclusions"),
                "unmapped": [
                    {"field": n["field"], "values": n["unmapped_values"][:20]}
                    for n in (run_report.get("normalization") or [])
                    if n.get("unmapped_values")
                ],
            },
            "variance": {
                "between_appraiser": result.get("between_appraiser_variance"),
                "within_claim": result.get("within_claim_variance"),
            },
            "stratum_accounting": result.get("stratum_accounting"),
            "ranked": result.get("ranked"),
            "unranked": result.get("unranked"),
            "bias_diagnostics": [b for b in (result.get("bias_diagnostics") or []) if b.get("flags")],
        }
    )


def write_outputs(result: Dict, run_report: Dict, out_dir: str) -> Dict[str, str]:
    os.makedirs(out_dir, exist_ok=True)

    md_path = os.path.join(out_dir, "scorecard.md")
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(render_markdown(result, run_report))

    json_path = os.path.join(out_dir, "scorecard.json")
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(render_json(result, run_report), fh, indent=2)

    claims = result.get("claims")
    claims_path = os.path.join(out_dir, "claims-scored.csv")
    if isinstance(claims, pd.DataFrame):
        claims.to_csv(claims_path, index=False)

    return {"markdown": md_path, "json": json_path, "claims": claims_path}
