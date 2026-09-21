"""Pulling dollar figures out of estimate and award PDFs.

The governing rule: THIS MODULE NEVER GUESSES. Every returned figure carries a
confidence level and full provenance (file, page, the exact line it came from).
When the evidence is ambiguous — two different candidate amounts, an unlabelled
number, a scanned page with no text layer — it returns no value and says why, so
the claim lands in the human review queue instead of in the scorecard.

That is the whole difference between this and asking a model to read the PDFs.
A model asked for "the RCV" always returns a number. Half the value here is the
refusal.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Sequence, Tuple

CONF_HIGH = "high"
CONF_MEDIUM = "medium"
CONF_LOW = "low"
CONF_NONE = "none"

_CONF_RANK = {CONF_NONE: 0, CONF_LOW: 1, CONF_MEDIUM: 2, CONF_HIGH: 3, "confirmed": 4}


def confidence_at_least(value: str, floor: str) -> bool:
    return _CONF_RANK.get(value, 0) >= _CONF_RANK.get(floor, 99)


# A currency amount, optionally parenthesised (negative) — Xactimate writes
# deductions as ($2,500.00).
_AMOUNT = r"\(?\$?\s?(-?[\d,]+\.\d{2}|-?[\d,]{4,})\)?"

# Primary labels: an unambiguous statement of replacement cost value. These are
# the exact strings Xactimate puts on a summary page.
PRIMARY_RCV_LABELS = [
    r"replacement\s+cost\s+value",
    r"total\s+replacement\s+cost\s+value",
    r"\brcv\b",
]

# Secondary labels: plausible but weaker. A hit here alone is MEDIUM at best,
# because "Total" on an estimate can mean several different things.
SECONDARY_RCV_LABELS = [
    r"total\s+estimate",
    r"estimate\s+total",
    r"total\s+cost",
    r"net\s+claim\s+if\s+depreciation\s+is\s+recovered",
]

# Labels whose amounts must NEVER be mistaken for RCV. Matching one of these on a
# line vetoes that line entirely.
VETO_LABELS = [
    r"actual\s+cash\s+value",
    r"\bacv\b",
    r"less\s+depreciation",
    r"depreciation",
    r"deductible",
    r"net\s+claim",
    r"prior\s+payments?",
    r"amount\s+paid",
    r"overhead",
    r"sales\s+tax",
    r"recoverable",
    r"supplement\s+only",
]

PRIMARY_AWARD_LABELS = [
    r"appraisal\s+award",
    r"total\s+award",
    r"award\s+amount",
    r"amount\s+of\s+loss",
    r"agreed\s+(?:upon\s+)?amount",
]

SECONDARY_AWARD_LABELS = [
    r"\baward\b",
    r"replacement\s+cost\s+value",
    r"total\s+amount\s+of\s+loss",
]


@dataclass
class Candidate:
    amount: float
    label: str
    page: int
    line: str
    tier: str  # "primary" | "secondary"

    def as_dict(self) -> Dict[str, object]:
        return asdict(self)


@dataclass
class Extraction:
    """One attempted read of one figure from one document."""

    value: Optional[float] = None
    confidence: str = CONF_NONE
    reason: str = ""
    source_file: str = ""
    page: Optional[int] = None
    source_line: str = ""
    candidates: List[Candidate] = field(default_factory=list)

    def as_row(self, prefix: str) -> Dict[str, object]:
        return {
            f"{prefix}_value": self.value,
            f"{prefix}_confidence": self.confidence,
            f"{prefix}_reason": self.reason,
            f"{prefix}_source_file": self.source_file,
            f"{prefix}_source_page": self.page,
            f"{prefix}_source_line": self.source_line,
            f"{prefix}_candidate_count": len(self.candidates),
        }


def parse_amount(raw: str) -> Optional[float]:
    """'$45,231.87' -> 45231.87; '($2,500.00)' -> -2500.0."""
    if raw is None:
        return None
    text = str(raw).strip()
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()").replace("$", "").replace(",", "").strip()
    if not text:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return -value if negative else value


def _matches_any(text: str, patterns: Sequence[str]) -> Optional[str]:
    for pattern in patterns:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return pattern
    return None


def scan_text(
    text: str,
    page: int,
    primary: Sequence[str],
    secondary: Sequence[str],
) -> List[Candidate]:
    """Find labelled amounts on a page.

    Only lines carrying BOTH a recognised label and an amount count. An amount
    with no label is ignored — on an estimate summary that is usually a line item
    or a page number, and treating it as a total is how you get a figure that is
    wrong by an order of magnitude and looks fine.
    """
    found: List[Candidate] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if _matches_any(line, VETO_LABELS):
            continue

        amounts = re.findall(_AMOUNT, line)
        if not amounts:
            continue

        tier, label = None, None
        hit = _matches_any(line, primary)
        if hit:
            tier, label = "primary", hit
        else:
            hit = _matches_any(line, secondary)
            if hit:
                tier, label = "secondary", hit
        if not tier:
            continue

        # The figure is the last amount on the line: labels sit left, values right,
        # and a line like "Replacement Cost Value (1,250 sq ft) $45,231.87" would
        # otherwise yield the square footage.
        value = parse_amount(amounts[-1])
        if value is None or value <= 0:
            continue

        found.append(Candidate(amount=value, label=label, page=page, line=line, tier=tier))
    return found


def read_pdf_pages(path: str) -> List[str]:
    """Page text, or [] if the file has no text layer (i.e. it is a scan)."""
    import pdfplumber

    pages: List[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return pages


def _resolve(candidates: List[Candidate], source_file: str) -> Extraction:
    """Turn raw candidates into a decision, refusing when the evidence conflicts."""
    if not candidates:
        return Extraction(
            confidence=CONF_NONE,
            reason="no labelled total found in document",
            source_file=source_file,
        )

    primaries = [c for c in candidates if c.tier == "primary"]
    pool = primaries or candidates
    tier_name = "primary" if primaries else "secondary"

    distinct = sorted({round(c.amount, 2) for c in pool})

    if len(distinct) == 1:
        best = pool[0]
        # A single unambiguous primary label is the only path to HIGH. Repeated
        # identical primaries (summary page plus recap page) still count as
        # unambiguous.
        confidence = CONF_HIGH if primaries else CONF_MEDIUM
        reason = (
            f"single {tier_name} label, {len(pool)} consistent match(es)"
            if len(pool) > 1
            else f"single {tier_name} label match"
        )
        return Extraction(
            value=best.amount,
            confidence=confidence,
            reason=reason,
            source_file=source_file,
            page=best.page,
            source_line=best.line,
            candidates=candidates,
        )

    # Conflicting amounts. This is precisely the case that must not be resolved
    # automatically — a supplement recap and an original estimate in one file, a
    # revised page, a multi-structure claim. Send it to a human.
    spread = (max(distinct) - min(distinct)) / max(distinct)
    return Extraction(
        value=None,
        confidence=CONF_NONE,
        reason=(
            f"conflicting {tier_name} amounts ({len(distinct)} distinct values, "
            f"{spread:.0%} spread) — needs human review"
        ),
        source_file=source_file,
        candidates=candidates,
    )


def extract_figure(path: str, kind: str) -> Extraction:
    """Extract the pre-appraisal RCV ('rcv') or the award amount ('award')."""
    if kind == "rcv":
        primary, secondary = PRIMARY_RCV_LABELS, SECONDARY_RCV_LABELS
    elif kind == "award":
        primary, secondary = PRIMARY_AWARD_LABELS, SECONDARY_AWARD_LABELS
    else:
        raise ValueError(f"unknown extraction kind: {kind!r}")

    name = os.path.basename(path)

    if not os.path.exists(path):
        return Extraction(confidence=CONF_NONE, reason="file not found", source_file=name)

    try:
        pages = read_pdf_pages(path)
    except Exception as exc:  # unreadable/encrypted/corrupt
        return Extraction(
            confidence=CONF_NONE,
            reason=f"could not read PDF: {type(exc).__name__}",
            source_file=name,
        )

    if not any(p.strip() for p in pages):
        return Extraction(
            confidence=CONF_NONE,
            reason="no text layer (scanned image) — needs OCR or manual entry",
            source_file=name,
        )

    candidates: List[Candidate] = []
    for index, text in enumerate(pages, start=1):
        candidates.extend(scan_text(text, index, primary, secondary))

    return _resolve(candidates, name)


def find_pdf(pdf_dir: str, *keys: object) -> Optional[str]:
    """Locate a PDF by job id / claim number appearing in its filename.

    Used when the export has no explicit filename column. Returns None on
    ambiguity — two files matching the same job is a filing problem the pipeline
    must report, not silently pick a side on.
    """
    if not pdf_dir or not os.path.isdir(pdf_dir):
        return None

    wanted = [str(k).strip().lower() for k in keys if k not in (None, "") and str(k).strip()]
    if not wanted:
        return None

    matches: List[str] = []
    for root, _dirs, files in os.walk(pdf_dir):
        for filename in files:
            if not filename.lower().endswith(".pdf"):
                continue
            lowered = filename.lower()
            if any(key in lowered for key in wanted):
                matches.append(os.path.join(root, filename))

    if len(matches) == 1:
        return matches[0]
    return None
