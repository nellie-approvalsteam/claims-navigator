"""Turning per-claim metrics into a defensible per-appraiser ranking.

The method, and why each piece is there:

1. STRATIFY. Claims are bucketed by carrier x trade x size band, and each claim
   is scored against its own bucket's mean rather than against the roster mean.
   This is what makes the answer "did better than expected FOR THAT KIND OF
   CLAIM" instead of "handled bigger claims".

2. FALL BACK, DON'T DISCARD. A claim whose full bucket is too thin is compared at
   the coarsest level that still has enough data (carrier x size, then trade x
   size, then size). The level used is recorded per claim, because a roster whose
   comparisons all happen at "size alone" is barely controlled at all.

3. SHRINK. Raw means over 10 claims are mostly noise. Empirical-Bayes shrinkage
   pulls each appraiser toward the roster average in proportion to how little
   data stands behind them, so one lucky award cannot top the table.

4. BOOTSTRAP, THEN TIER. Cluster bootstrap gives each appraiser an interval, and
   appraisers whose intervals overlap the tier leader's are reported as ONE TIER.
   With a roster this size the honest answer is usually "these three are
   indistinguishable", and the report is built to be able to say that.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .config import Config

FALLBACK_LEVELS = [
    ("carrier+trade+size", ["carrier", "trade", "size_band"]),
    ("carrier+size", ["carrier", "size_band"]),
    ("trade+size", ["trade", "size_band"]),
    ("size", ["size_band"]),
    ("all", []),
]


def add_size_bands(frame: pd.DataFrame, bands: int) -> pd.DataFrame:
    """Size bands as quantiles of pre-appraisal RCV, derived from the data.

    Quantiles rather than fixed dollar cuts, so the bands stay balanced whatever
    the book of business looks like.
    """
    out = frame.copy()
    if out.empty:
        out["size_band"] = pd.Series(dtype="object")
        return out

    values = pd.to_numeric(out["pre_rcv"], errors="coerce")
    valid = values.dropna()
    if valid.empty or valid.nunique() < 2:
        out["size_band"] = "all"
        return out

    effective = min(bands, max(1, valid.nunique()))
    try:
        cut = pd.qcut(values, q=effective, duplicates="drop")
        out["size_band"] = cut.astype(str)
    except (ValueError, IndexError):
        out["size_band"] = "all"
    out.loc[values.isna(), "size_band"] = "unknown"
    return out


def pool_small_carriers(frame: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    """Pool rare carriers so stratification has something to work with.

    The original carrier is preserved in `carrier_reported` — pooling is for
    comparison only and must not hide which carrier a claim actually came from.
    """
    out = frame.copy()
    if out.empty:
        out["carrier_reported"] = pd.Series(dtype="object")
        return out

    threshold = int(cfg.carriers.get("min_claims_to_stand_alone", 0) or 0)
    bucket = str(cfg.carriers.get("small_carrier_bucket", "Other Carriers"))

    out["carrier_reported"] = out["carrier"]
    if threshold > 1:
        counts = out["carrier"].value_counts()
        rare = {c for c, n in counts.items() if n < threshold}
        out["carrier"] = out["carrier"].apply(lambda c: bucket if c in rare else c)
    return out


def assign_strata(frame: pd.DataFrame, cfg: Config) -> Tuple[pd.DataFrame, List[Dict]]:
    """Give every usable claim a stratum mean and a residual.

    Returns the annotated frame plus a per-level accounting of how many claims
    were resolved where.
    """
    min_n = int(cfg.get("stratification", "min_stratum_n", default=3))
    min_appraisers = int(cfg.get("stratification", "min_appraisers_per_stratum", default=2))
    allow_fallback = bool(cfg.get("stratification", "enable_fallback_strata", default=True))
    target = str(cfg.get("metric", "target", default="net_increase_pct"))

    out = frame.copy()
    out["stratum_key"] = None
    out["stratum_level"] = None
    out["stratum_mean"] = np.nan
    out["stratum_n"] = np.nan
    out["residual"] = np.nan

    if out.empty:
        return out, []

    usable_mask = out["usable"].astype(bool) & out[target].notna()
    levels = FALLBACK_LEVELS if allow_fallback else FALLBACK_LEVELS[:1] + [FALLBACK_LEVELS[-1]]

    unresolved = usable_mask.copy()
    accounting: List[Dict] = []

    for level_name, keys in levels:
        if not unresolved.any():
            break

        pool = out[unresolved]
        if keys:
            grouped = pool.groupby(keys, dropna=False)
        else:
            grouped = [("all", pool)]

        resolved_here = 0
        for key, group in (grouped if keys else grouped):
            n = len(group)
            distinct_appraisers = group["appraiser"].nunique()

            # The last level is unconditional: everything left has to land
            # somewhere, or it silently vanishes from the analysis.
            is_last = level_name == "all"
            if not is_last and (n < min_n or distinct_appraisers < min_appraisers):
                continue

            mean = float(pd.to_numeric(group[target], errors="coerce").mean())
            index = group.index
            out.loc[index, "stratum_key"] = (
                " | ".join(str(k) for k in (key if isinstance(key, tuple) else (key,)))
            )
            out.loc[index, "stratum_level"] = level_name
            out.loc[index, "stratum_mean"] = mean
            out.loc[index, "stratum_n"] = n
            out.loc[index, "residual"] = pd.to_numeric(group[target], errors="coerce") - mean
            unresolved.loc[index] = False
            resolved_here += n

        if resolved_here:
            accounting.append({"level": level_name, "claims_resolved": int(resolved_here)})

    return out, accounting


def _empirical_bayes(effects: np.ndarray, ns: np.ndarray, within_var: float):
    """Shrink per-appraiser means toward 0 (the stratum-adjusted roster average).

    tau2 is the between-appraiser variance estimated by method of moments: the
    spread we actually observe, minus the spread pure sampling noise would
    produce anyway. If that difference is <= 0 the data cannot distinguish the
    appraisers at all, every weight goes to 0, and the table correctly flattens.
    """
    ns = np.maximum(ns.astype(float), 1.0)
    se2 = within_var / ns

    if len(effects) < 2:
        return np.zeros_like(effects), np.zeros_like(effects), 0.0

    observed_var = float(np.var(effects, ddof=1))
    tau2 = max(0.0, observed_var - float(np.mean(se2)))

    weights = np.zeros_like(effects, dtype=float) if tau2 <= 0 else tau2 / (tau2 + se2)
    return effects * weights, weights, tau2


def _bootstrap(
    residuals_by_appraiser: Dict[str, np.ndarray],
    order: List[str],
    within_var: float,
    iterations: int,
    level: float,
    seed: int,
) -> Dict[str, Tuple[float, float]]:
    """Cluster bootstrap: resample each appraiser's own claims, with replacement.

    Shrinkage is recomputed inside every iteration rather than held fixed, so the
    interval reflects uncertainty in the shrinkage itself and not just in the raw
    mean.
    """
    rng = np.random.default_rng(seed)
    ns = np.array([len(residuals_by_appraiser[a]) for a in order], dtype=float)
    draws = np.empty((iterations, len(order)), dtype=float)

    for i in range(iterations):
        sample_means = np.empty(len(order), dtype=float)
        for j, name in enumerate(order):
            values = residuals_by_appraiser[name]
            picks = rng.integers(0, len(values), size=len(values))
            sample_means[j] = values[picks].mean()
        shrunk, _, _ = _empirical_bayes(sample_means, ns, within_var)
        draws[i] = shrunk

    alpha = (1.0 - level) / 2.0
    lo = np.quantile(draws, alpha, axis=0)
    hi = np.quantile(draws, 1.0 - alpha, axis=0)
    return {name: (float(lo[j]), float(hi[j])) for j, name in enumerate(order)}


def _assign_tiers(rows: List[Dict], tolerance: float) -> None:
    """Group appraisers whose intervals overlap the tier leader's.

    A new tier begins only when a candidate's whole interval sits below the
    leader's — i.e. when the data genuinely separates them. Everything else stays
    in the leader's tier and is reported as indistinguishable.
    """
    tier = 0
    leader_low: Optional[float] = None
    for row in rows:
        if leader_low is None:
            tier = 1
            leader_low = row["ci_low"]
        elif row["ci_high"] < leader_low - tolerance:
            tier += 1
            leader_low = row["ci_low"]
        row["tier"] = tier


def build(frame: pd.DataFrame, cfg: Config) -> Dict[str, object]:
    """Produce the scorecard from a metrics frame."""
    target = str(cfg.get("metric", "target", default="net_increase_pct"))
    min_claims = int(cfg.get("scoring", "min_claims_to_rank", default=8))
    iterations = int(cfg.get("scoring", "bootstrap_iterations", default=2000))
    level = float(cfg.get("scoring", "confidence_level", default=0.90))
    seed = int(cfg.get("scoring", "random_seed", default=0))
    tolerance = float(cfg.get("scoring", "tier_overlap_tolerance", default=0.0))
    bands = int(cfg.get("stratification", "size_bands", default=4))

    prepared = pool_small_carriers(frame, cfg)
    prepared = add_size_bands(prepared, bands)
    prepared, accounting = assign_strata(prepared, cfg)

    usable = prepared[prepared["usable"].astype(bool) & prepared["residual"].notna()].copy()

    descriptive = _descriptive(prepared)
    bias = _bias_diagnostics(prepared, usable, cfg)

    if usable.empty:
        return {
            "target_metric": target,
            "ranked": [],
            "unranked": descriptive,
            "stratum_accounting": accounting,
            "bias_diagnostics": bias,
            "claims": prepared,
            "note": "No claims survived the validity gate — nothing can be ranked.",
        }

    counts = usable["appraiser"].value_counts()
    eligible = [a for a, n in counts.items() if n >= min_claims]

    if len(eligible) < 2:
        return {
            "target_metric": target,
            "ranked": [],
            "unranked": descriptive,
            "stratum_accounting": accounting,
            "bias_diagnostics": bias,
            "claims": prepared,
            "note": (
                f"Fewer than two appraisers have the {min_claims} usable claims "
                f"required to be ranked. This is a data-volume finding, not a "
                f"tie — see the per-appraiser table for what is there."
            ),
        }

    residuals = {
        a: usable.loc[usable["appraiser"] == a, "residual"].astype(float).to_numpy()
        for a in eligible
    }
    order = sorted(eligible)
    raw_effects = np.array([residuals[a].mean() for a in order])
    ns = np.array([len(residuals[a]) for a in order], dtype=float)

    # Pooled within-appraiser variance — the noise floor a single claim carries.
    pooled = np.concatenate([residuals[a] - residuals[a].mean() for a in order])
    dof = max(1, len(pooled) - len(order))
    within_var = float(np.sum(pooled**2) / dof)

    shrunk, weights, tau2 = _empirical_bayes(raw_effects, ns, within_var)
    intervals = _bootstrap(residuals, order, within_var, iterations, level, seed)

    desc_by_name = {d["appraiser"]: d for d in descriptive}
    rows: List[Dict] = []
    for j, name in enumerate(order):
        lo, hi = intervals[name]
        row = {
            "appraiser": name,
            "usable_claims": int(ns[j]),
            "raw_effect": float(raw_effects[j]),
            "adjusted_effect": float(shrunk[j]),
            "shrinkage_weight": float(weights[j]),
            "ci_low": lo,
            "ci_high": hi,
            "ci_excludes_zero": bool(lo > 0 or hi < 0),
        }
        row.update({k: v for k, v in desc_by_name.get(name, {}).items() if k != "appraiser"})
        rows.append(row)

    rows.sort(key=lambda r: r["adjusted_effect"], reverse=True)
    _assign_tiers(rows, tolerance)

    separable = len({r["tier"] for r in rows}) > 1

    return {
        "target_metric": target,
        "ranked": rows,
        "unranked": [d for d in descriptive if d["appraiser"] not in set(eligible)],
        "stratum_accounting": accounting,
        "bias_diagnostics": bias,
        "between_appraiser_variance": tau2,
        "within_claim_variance": within_var,
        "separable": separable,
        "confidence_level": level,
        "claims": prepared,
        "note": (
            ""
            if separable
            else (
                "No appraiser separates from the tier leader at this confidence "
                "level. On this data the roster is statistically indistinguishable "
                "— report it that way rather than ranking on noise."
            )
        ),
    }


def _descriptive(frame: pd.DataFrame) -> List[Dict]:
    """Plain per-appraiser numbers, unadjusted. Shown alongside the adjusted score
    because people will ask for them, and because the gap between the two is
    itself informative."""
    if frame.empty:
        return []

    rows: List[Dict] = []
    for name, group in frame.groupby("appraiser", dropna=False):
        if not str(name).strip():
            continue
        usable = group[group["usable"].astype(bool)]
        rows.append(
            {
                "appraiser": str(name),
                "claims_total": int(len(group)),
                "claims_usable": int(len(usable)),
                "mean_increase_pct": _safe_mean(usable, "increase_pct"),
                "median_increase_pct": _safe_median(usable, "increase_pct"),
                "mean_net_increase_pct": _safe_mean(usable, "net_increase_pct"),
                "mean_increase_usd": _safe_mean(usable, "increase_usd"),
                "total_net_increase_usd": _safe_sum(usable, "net_increase_usd"),
                "median_cycle_days": _safe_median(usable, "cycle_days"),
                "umpire_rate": _rate(group, "umpire_used"),
            }
        )
    rows.sort(key=lambda r: (r["mean_net_increase_pct"] is None, -(r["mean_net_increase_pct"] or 0)))
    return rows


def _bias_diagnostics(frame: pd.DataFrame, usable: pd.DataFrame, cfg: Config) -> List[Dict]:
    """Is each appraiser's caseload comparable to the roster's?

    Nothing here changes a score. It decides when the report has to warn that a
    comparison is not apples to apples — which, on a roster where specialists
    hand-pick who gets which claim, is the failure mode most likely to make the
    whole exercise misleading.
    """
    if frame.empty:
        return []

    max_carrier = float(cfg.get("bias_flags", "max_single_carrier_share", default=1.0))
    max_trade = float(cfg.get("bias_flags", "max_single_trade_share", default=1.0))
    max_ratio = float(cfg.get("bias_flags", "max_size_ratio_vs_roster", default=99.0))
    min_stratum_share = float(cfg.get("bias_flags", "min_usable_stratum_share", default=0.0))

    sizes = pd.to_numeric(frame["pre_rcv"], errors="coerce").dropna()
    roster_log_mean = float(np.log(sizes[sizes > 0]).mean()) if (sizes > 0).any() else None

    rows: List[Dict] = []
    for name, group in frame.groupby("appraiser", dropna=False):
        if not str(name).strip():
            continue

        flags: List[str] = []
        carrier_share = _top_share(group, "carrier_reported")
        trade_share = _top_share(group, "trade")

        if carrier_share and carrier_share["share"] > max_carrier:
            flags.append(
                f"{carrier_share['share']:.0%} of claims from one carrier "
                f"({carrier_share['value']}) — not comparable to a mixed caseload"
            )
        if trade_share and trade_share["share"] > max_trade:
            flags.append(
                f"{trade_share['share']:.0%} of claims are one trade ({trade_share['value']})"
            )

        size_ratio = None
        own = pd.to_numeric(group["pre_rcv"], errors="coerce").dropna()
        own = own[own > 0]
        if roster_log_mean is not None and not own.empty:
            size_ratio = float(np.exp(np.log(own).mean() - roster_log_mean))
            if size_ratio > max_ratio or size_ratio < 1.0 / max_ratio:
                flags.append(
                    f"typical claim is {size_ratio:.1f}x the roster's — size band "
                    f"controls may not fully absorb this"
                )

        own_usable = usable[usable["appraiser"] == name] if not usable.empty else usable
        full_share = None
        if len(own_usable) > 0:
            full = (own_usable["stratum_level"] == "carrier+trade+size").sum()
            full_share = float(full / len(own_usable))
            if full_share < min_stratum_share:
                flags.append(
                    f"only {full_share:.0%} of claims compared at full "
                    f"carrier x trade x size detail — the rest use coarser controls"
                )

        rows.append(
            {
                "appraiser": str(name),
                "claims": int(len(group)),
                "top_carrier": carrier_share["value"] if carrier_share else None,
                "top_carrier_share": carrier_share["share"] if carrier_share else None,
                "top_trade": trade_share["value"] if trade_share else None,
                "top_trade_share": trade_share["share"] if trade_share else None,
                "size_ratio_vs_roster": size_ratio,
                "full_stratum_share": full_share,
                "flags": flags,
            }
        )
    return rows


def _top_share(group: pd.DataFrame, column: str) -> Optional[Dict]:
    if column not in group or group.empty:
        return None
    counts = group[column].value_counts(dropna=False)
    if counts.empty:
        return None
    return {"value": str(counts.index[0]), "share": float(counts.iloc[0] / len(group))}


def _safe_mean(frame: pd.DataFrame, column: str):
    if column not in frame or frame.empty:
        return None
    values = pd.to_numeric(frame[column], errors="coerce").dropna()
    return float(values.mean()) if not values.empty else None


def _safe_median(frame: pd.DataFrame, column: str):
    if column not in frame or frame.empty:
        return None
    values = pd.to_numeric(frame[column], errors="coerce").dropna()
    return float(values.median()) if not values.empty else None


def _safe_sum(frame: pd.DataFrame, column: str):
    if column not in frame or frame.empty:
        return None
    values = pd.to_numeric(frame[column], errors="coerce").dropna()
    return float(values.sum()) if not values.empty else None


def _rate(frame: pd.DataFrame, column: str):
    if column not in frame or frame.empty:
        return None
    values = frame[column].dropna()
    if values.empty:
        return None
    return float(values.astype(bool).mean())
