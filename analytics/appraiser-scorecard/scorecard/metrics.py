"""Per-claim metrics, plus the validity gate.

The important design choice: an excluded claim is never simply absent. Each one
carries an `exclusion_reason`, the reasons are tallied in the run report, and
suspicious values are routed to review rather than thrown away. A scorecard built
on 60% of the claims with no note of the other 40% is worse than no scorecard,
because it looks complete.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from .config import Config
from .extract import confidence_at_least

TARGETS = {"net_increase_pct", "increase_pct", "net_increase_usd", "increase_usd"}


def _fee_for(row: pd.Series, cfg: Config) -> float:
    """Appraiser fee: the export's value if present, otherwise the configured model."""
    explicit = row.get("appraiser_fee")
    if explicit is not None and not pd.isna(explicit):
        return float(explicit)

    model = cfg.get("fees", "default_model", default="none")
    gross = row.get("increase_usd") or 0.0
    if model == "percent_of_increase":
        pct = float(cfg.get("fees", "default_percent", default=0.0))
        return max(0.0, float(gross) * pct)
    if model == "flat":
        return float(cfg.get("fees", "default_flat_usd", default=0.0))
    return 0.0


def _umpire_cost_for(row: pd.Series, cfg: Config) -> float:
    """Our share of the umpire fee, charged only when an umpire was actually used."""
    used = row.get("umpire_used")
    explicit = row.get("umpire_fee")
    share = float(cfg.get("fees", "umpire_share", default=0.5))

    if explicit is not None and not pd.isna(explicit):
        return float(explicit) * share
    if used is True:
        return float(cfg.get("fees", "default_umpire_fee_usd", default=0.0)) * share
    return 0.0


def compute(frame: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    """Add per-claim metric columns and the usability verdict."""
    out = frame.copy()
    if out.empty:
        for col in (
            "pre_rcv", "award_rcv", "increase_usd", "increase_pct",
            "appraiser_fee_used", "umpire_cost_used", "net_increase_usd",
            "net_increase_pct", "cycle_days", "usable", "exclusion_reason",
            "needs_review",
        ):
            out[col] = pd.Series(dtype="object")
        return out

    min_conf = cfg.get("extraction", "min_confidence", default="high")
    accept_confirmed = bool(cfg.get("extraction", "accept_human_confirmed", default=True))

    def _resolve_figure(row: pd.Series, field_col: str, ext_col: str, conf_col: str):
        """Prefer a real CRM field over a parsed PDF — a typed number that someone
        is accountable for beats a regex every time."""
        native = row.get(field_col)
        if native is not None and not pd.isna(native) and float(native) > 0:
            return float(native), "crm_field"

        parsed = row.get(ext_col)
        conf = str(row.get(conf_col) or "none")
        if parsed is not None and not pd.isna(parsed) and float(parsed) > 0:
            ok = confidence_at_least(conf, min_conf) or (
                accept_confirmed and conf == "confirmed"
            )
            if ok:
                return float(parsed), f"pdf_{conf}"
            return None, f"pdf_below_threshold({conf})"
        return None, "missing"

    pre_vals, pre_srcs, award_vals, award_srcs = [], [], [], []
    for _, row in out.iterrows():
        pv, ps = _resolve_figure(row, "pre_rcv_field", "pre_rcv_extracted", "pre_rcv_confidence")
        av, asrc = _resolve_figure(row, "award_rcv_field", "award_rcv_extracted", "award_rcv_confidence")
        pre_vals.append(pv)
        pre_srcs.append(ps)
        award_vals.append(av)
        award_srcs.append(asrc)

    out["pre_rcv"] = pre_vals
    out["pre_rcv_source"] = pre_srcs
    out["award_rcv"] = award_vals
    out["award_rcv_source"] = award_srcs

    out["increase_usd"] = out.apply(
        lambda r: (r["award_rcv"] - r["pre_rcv"])
        if pd.notna(r["pre_rcv"]) and pd.notna(r["award_rcv"])
        else np.nan,
        axis=1,
    )
    out["increase_pct"] = out.apply(
        lambda r: (r["increase_usd"] / r["pre_rcv"])
        if pd.notna(r.get("increase_usd")) and pd.notna(r["pre_rcv"]) and r["pre_rcv"] > 0
        else np.nan,
        axis=1,
    )

    out["appraiser_fee_used"] = out.apply(lambda r: _fee_for(r, cfg), axis=1)
    out["umpire_cost_used"] = out.apply(lambda r: _umpire_cost_for(r, cfg), axis=1)

    out["net_increase_usd"] = out["increase_usd"] - out["appraiser_fee_used"] - out["umpire_cost_used"]
    out["net_increase_pct"] = out.apply(
        lambda r: (r["net_increase_usd"] / r["pre_rcv"])
        if pd.notna(r.get("net_increase_usd")) and pd.notna(r["pre_rcv"]) and r["pre_rcv"] > 0
        else np.nan,
        axis=1,
    )

    def _cycle(row):
        start, end = row.get("appraisal_invoked_date"), row.get("award_date")
        if pd.isna(start) or pd.isna(end) or start is None or end is None:
            return np.nan
        try:
            return float((pd.Timestamp(end) - pd.Timestamp(start)).days)
        except Exception:
            return np.nan

    out["cycle_days"] = out.apply(_cycle, axis=1)

    verdicts = out.apply(lambda r: _verdict(r, cfg), axis=1)
    out["usable"] = [v[0] for v in verdicts]
    out["exclusion_reason"] = [v[1] for v in verdicts]
    out["needs_review"] = [v[2] for v in verdicts]
    return out


def _verdict(row: pd.Series, cfg: Config):
    """(usable, exclusion_reason, needs_review) for one claim."""
    if not str(row.get("appraiser") or "").strip():
        return False, "no appraiser recorded", False
    if str(row.get("carrier")) == "UNMAPPED":
        return False, "carrier could not be normalised", True

    if pd.isna(row.get("pre_rcv")):
        return False, f"pre-appraisal RCV unavailable ({row.get('pre_rcv_source')})", True
    if pd.isna(row.get("award_rcv")):
        return False, f"award amount unavailable ({row.get('award_rcv_source')})", True

    min_pre = float(cfg.get("validity", "min_pre_rcv_usd", default=0))
    if float(row["pre_rcv"]) < min_pre:
        return False, f"pre-appraisal RCV below ${min_pre:,.0f} floor", True

    pct = row.get("increase_pct")
    lo = float(cfg.get("validity", "min_increase_pct", default=-1))
    hi = float(cfg.get("validity", "max_increase_pct", default=99))
    if pd.isna(pct):
        return False, "increase could not be computed", True
    if pct < lo or pct > hi:
        # Almost always a parsing error, not a real result. Review, do not discard.
        return False, f"increase {pct:.0%} outside sanity bounds — suspected bad figure", True

    cycle = row.get("cycle_days")
    max_cycle = float(cfg.get("validity", "max_cycle_days", default=10**6))
    if pd.notna(cycle) and (cycle < 0 or cycle > max_cycle):
        return True, "", True  # usable for increase, but the dates are wrong

    return True, "", False


def exclusion_summary(frame: pd.DataFrame) -> List[Dict[str, object]]:
    if frame.empty or "exclusion_reason" not in frame:
        return []
    excluded = frame[~frame["usable"].astype(bool)]
    if excluded.empty:
        return []
    counts = excluded["exclusion_reason"].value_counts()
    total = len(frame)
    return [
        {"reason": str(reason), "claims": int(n), "share_of_all": round(n / total, 4)}
        for reason, n in counts.items()
    ]
