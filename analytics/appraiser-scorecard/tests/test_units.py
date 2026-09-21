"""Unit tests for the parts where a silent bug would corrupt the answer."""

import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scorecard.config import Config
from scorecard.extract import (CONF_HIGH, CONF_NONE, parse_amount, scan_text,
                               PRIMARY_RCV_LABELS, SECONDARY_RCV_LABELS, _resolve)
from scorecard.metrics import compute
from scorecard.normalize import Normalizer, normalize_person, resolve_columns
from scorecard.scoring import _assign_tiers, _empirical_bayes, build

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config")


@pytest.fixture(scope="module")
def cfg():
    return Config.load(CONFIG_DIR)


# --------------------------------------------------------------------------
# Normalization
# --------------------------------------------------------------------------

def test_carrier_variants_collapse(cfg):
    norm = Normalizer(cfg.carriers["canonical"], "carrier")
    for variant in ["State Farm", "STATE FARM", "St. Farm", "State Farm Ins Co",
                    "state farm insurance company"]:
        assert norm.normalize(variant) == "State Farm", variant


def test_unmapped_carrier_is_reported_not_guessed(cfg):
    norm = Normalizer(cfg.carriers["canonical"], "carrier")
    assert norm.normalize("Bob's Discount Insurance") == "UNMAPPED"
    assert norm.report()["unmapped_total_rows"] == 1


def test_person_name_forms_collapse():
    assert normalize_person("Whitfield, Dana") == "Dana Whitfield"
    assert normalize_person("  dana   whitfield ") == "Dana Whitfield"
    assert normalize_person("Dana Whitfield, PA") == "Dana Whitfield"
    assert normalize_person("Mr. Dana Whitfield") == "Dana Whitfield"


def test_column_resolution_is_punctuation_insensitive():
    resolved = resolve_columns(
        ["Job #", "Insurance  Company", "Appraiser Name"],
        {"job_id": ["Job ID", "Job #"], "carrier_raw": ["Insurance Company"],
         "appraiser_raw": ["Appraiser", "Appraiser Name"]},
    )
    assert resolved["job_id"] == "Job #"
    assert resolved["carrier_raw"] == "Insurance  Company"
    assert resolved["appraiser_raw"] == "Appraiser Name"


# --------------------------------------------------------------------------
# Extraction — the refusals matter more than the successes
# --------------------------------------------------------------------------

def test_parse_amount_handles_parenthesised_negatives():
    assert parse_amount("$45,231.87") == 45231.87
    assert parse_amount("($2,500.00)") == -2500.0
    assert parse_amount("not a number") is None


def test_acv_and_depreciation_never_read_as_rcv():
    page = """
    Line Item Total                                    $41,015.32
    Overhead and Profit (20%)                           $8,203.06
    Material Sales Tax                                  $1,234.00
    Replacement Cost Value                             $45,231.87
    Less Depreciation                                  ($8,120.44)
    Actual Cash Value                                  $37,111.43
    Less Deductible                                    ($2,500.00)
    Net Claim                                          $34,611.43
    """
    candidates = scan_text(page, 1, PRIMARY_RCV_LABELS, SECONDARY_RCV_LABELS)
    amounts = {c.amount for c in candidates}
    assert amounts == {45231.87}, f"vetoed lines leaked through: {amounts}"

    result = _resolve(candidates, "estimate.pdf")
    assert result.value == 45231.87
    assert result.confidence == CONF_HIGH
    assert result.page == 1


def test_conflicting_amounts_refuse_rather_than_pick():
    page = """
    --- ORIGINAL ---
    Replacement Cost Value                             $45,231.87
    --- REVISED ---
    Replacement Cost Value                             $52,880.15
    """
    candidates = scan_text(page, 1, PRIMARY_RCV_LABELS, SECONDARY_RCV_LABELS)
    result = _resolve(candidates, "estimate.pdf")
    assert result.value is None, "conflicting evidence must not resolve to a number"
    assert result.confidence == CONF_NONE
    assert "conflicting" in result.reason
    assert len(result.candidates) == 2  # both preserved for the reviewer


def test_unlabelled_amount_is_ignored():
    candidates = scan_text("Page 3 of 7          $12,345.00", 1,
                           PRIMARY_RCV_LABELS, SECONDARY_RCV_LABELS)
    assert candidates == []


def test_label_with_trailing_measurement_takes_the_last_amount():
    candidates = scan_text("Replacement Cost Value (1,250.00 sq ft)   $45,231.87", 1,
                           PRIMARY_RCV_LABELS, SECONDARY_RCV_LABELS)
    assert len(candidates) == 1
    assert candidates[0].amount == 45231.87


def test_empty_document_yields_no_value():
    result = _resolve([], "scan.pdf")
    assert result.value is None
    assert result.confidence == CONF_NONE


# --------------------------------------------------------------------------
# Metrics
# --------------------------------------------------------------------------

def _claim(**overrides):
    base = {
        "job_id": "J1", "appraiser": "Dana Whitfield", "carrier": "State Farm",
        "trade": "Roofing", "material": "Composition Shingle",
        "pre_rcv_field": None, "award_rcv_field": None,
        "pre_rcv_extracted": 50000.0, "pre_rcv_confidence": "high",
        "award_rcv_extracted": 60000.0, "award_rcv_confidence": "high",
        "appraiser_fee": None, "umpire_fee": None, "umpire_used": False,
        "appraisal_invoked_date": pd.Timestamp("2025-01-01"),
        "award_date": pd.Timestamp("2025-04-01"),
    }
    base.update(overrides)
    return base


def test_increase_and_fee_math(cfg):
    out = compute(pd.DataFrame([_claim()]), cfg).iloc[0]
    assert out["increase_usd"] == 10000.0
    assert out["increase_pct"] == pytest.approx(0.20)
    # default fee model is 10% of the gross increase
    assert out["appraiser_fee_used"] == pytest.approx(1000.0)
    assert out["net_increase_usd"] == pytest.approx(9000.0)
    assert out["net_increase_pct"] == pytest.approx(0.18)
    assert out["cycle_days"] == 90
    assert bool(out["usable"]) is True


def test_umpire_cost_only_charged_when_umpire_used(cfg):
    without = compute(pd.DataFrame([_claim()]), cfg).iloc[0]
    with_umpire = compute(pd.DataFrame([_claim(umpire_used=True)]), cfg).iloc[0]
    assert without["umpire_cost_used"] == 0.0
    # default $3,500 umpire fee, split 50/50
    assert with_umpire["umpire_cost_used"] == pytest.approx(1750.0)
    assert with_umpire["net_increase_usd"] < without["net_increase_usd"]


def test_low_confidence_extraction_is_excluded_and_flagged(cfg):
    out = compute(pd.DataFrame([_claim(award_rcv_confidence="low")]), cfg).iloc[0]
    assert not bool(out["usable"])
    assert bool(out["needs_review"])
    assert "award amount unavailable" in out["exclusion_reason"]


def test_crm_field_beats_parsed_pdf(cfg):
    out = compute(pd.DataFrame([_claim(pre_rcv_field=55000.0)]), cfg).iloc[0]
    assert out["pre_rcv"] == 55000.0
    assert out["pre_rcv_source"] == "crm_field"


def test_absurd_increase_is_routed_to_review_not_averaged_in(cfg):
    out = compute(pd.DataFrame([_claim(award_rcv_extracted=500000.0)]), cfg).iloc[0]
    assert not bool(out["usable"]), "a 900% increase must not enter the scorecard"
    assert bool(out["needs_review"])
    assert "sanity bounds" in out["exclusion_reason"]


def test_human_confirmation_outranks_thresholds(cfg):
    out = compute(pd.DataFrame([_claim(award_rcv_confidence="confirmed")]), cfg).iloc[0]
    assert bool(out["usable"])


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def test_shrinkage_pulls_small_samples_harder():
    # Real spread between the two, so tau2 > 0 and the weights are driven by n.
    effects = np.array([0.10, -0.08])
    ns = np.array([5.0, 200.0])
    shrunk, weights, tau2 = _empirical_bayes(effects, ns, within_var=0.04)
    assert tau2 > 0
    assert weights[0] < weights[1], "the 5-claim appraiser must be shrunk more"
    # The 5-claim appraiser keeps a far smaller share of their raw effect.
    assert abs(shrunk[0]) / abs(effects[0]) < abs(shrunk[1]) / abs(effects[1])


def test_no_real_spread_collapses_every_effect_to_zero():
    # Identical effects => observed variance is pure noise => tau2 = 0.
    effects = np.array([0.02, 0.02, 0.02])
    ns = np.array([30.0, 30.0, 30.0])
    shrunk, weights, tau2 = _empirical_bayes(effects, ns, within_var=0.05)
    assert tau2 == 0.0
    assert np.allclose(shrunk, 0.0)


def test_overlapping_intervals_share_a_tier():
    rows = [
        {"appraiser": "A", "adjusted_effect": 0.05, "ci_low": 0.01, "ci_high": 0.09},
        {"appraiser": "B", "adjusted_effect": 0.03, "ci_low": -0.01, "ci_high": 0.07},
        {"appraiser": "C", "adjusted_effect": -0.06, "ci_low": -0.10, "ci_high": -0.02},
    ]
    _assign_tiers(rows, tolerance=0.0)
    assert rows[0]["tier"] == rows[1]["tier"] == 1, "overlapping CIs must not be ranked apart"
    assert rows[2]["tier"] == 2


def test_too_few_appraisers_refuses_to_rank(cfg):
    frame = pd.DataFrame([_claim(job_id=f"J{i}") for i in range(30)])
    scored = compute(frame, cfg)
    result = build(scored, cfg)
    assert result["ranked"] == []
    assert "Fewer than two appraisers" in result["note"]
