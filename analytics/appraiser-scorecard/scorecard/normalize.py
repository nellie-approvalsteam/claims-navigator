"""Canonicalising free-text fields.

Unnormalised carrier and trade names are the quietest way to get a wrong answer:
grouping splits, per-group averages are computed over partial data, and nothing
in the output looks unusual. Everything that fails to map is surfaced as UNMAPPED
rather than dropped or guessed at.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, Iterable, List, Optional, Tuple

# Corporate suffixes stripped before matching. "State Farm Insurance Co." and
# "State Farm" should not be two carriers.
_SUFFIXES = {
    "inc", "llc", "lp", "llp", "co", "corp", "company", "companies",
    "ins", "insurance", "assurance", "group", "grp", "mutual", "mut",
    "underwriters", "casualty", "cas", "fire", "property", "and", "of",
    "the", "exchange", "services", "svc", "svcs", "usa", "us", "intl",
    "international", "national", "natl",
}

_UNMAPPED = "UNMAPPED"


def slug(value: object) -> str:
    """Aggressively fold a string for comparison: lowercase, ASCII, alnum only."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _token_key(value: object) -> str:
    """Fold further by dropping corporate suffix tokens. Used as a second pass."""
    tokens = [t for t in slug(value).split() if t and t not in _SUFFIXES]
    return " ".join(tokens)


def _compact(value: object) -> str:
    """Drop all separators: "U.S.A.A." and "USAA" both become "usaa".

    Periodized acronyms are extremely common in carrier names and would
    otherwise fall through to UNMAPPED.
    """
    return slug(value).replace(" ", "")


class Normalizer:
    """Maps raw free text onto a canonical label from a config-supplied table.

    Four passes, most specific first:
      1. exact slug match against a variant
      2. separator-free match ("U.S.A.A." -> "usaa")
      3. suffix-stripped token match
      4. token-containment (a variant's tokens are all present in the input)

    Pass 4 is what catches "State Farm Fire & Casualty Co of Texas". It is
    deliberately the last resort, and when two canonical labels both match it the
    input is reported as ambiguous rather than assigned to whichever came first.
    """

    def __init__(self, table: Dict[str, Iterable[str]], label: str = "value"):
        self.label = label
        self._exact: Dict[str, str] = {}
        self._tokens: Dict[str, str] = {}
        self._compact: Dict[str, str] = {}
        self._variant_tokens: List[Tuple[str, frozenset]] = []

        for canonical, variants in (table or {}).items():
            candidates = list(variants or []) + [canonical]
            for variant in candidates:
                s = slug(variant)
                if s:
                    self._exact.setdefault(s, canonical)
                c = _compact(variant)
                if c:
                    self._compact.setdefault(c, canonical)
                t = _token_key(variant)
                if t:
                    self._tokens.setdefault(t, canonical)
                    self._variant_tokens.append((canonical, frozenset(t.split())))

        self.unmapped: Dict[str, int] = {}
        self.ambiguous: Dict[str, List[str]] = {}

    def normalize(self, raw: object) -> str:
        s = slug(raw)
        if not s:
            return _UNMAPPED

        if s in self._exact:
            return self._exact[s]

        c = _compact(raw)
        if c and c in self._compact:
            return self._compact[c]

        t = _token_key(raw)
        if t and t in self._tokens:
            return self._tokens[t]

        if t:
            input_tokens = set(t.split())
            hits = {
                canonical
                for canonical, variant_tokens in self._variant_tokens
                if variant_tokens and variant_tokens <= input_tokens
            }
            if len(hits) == 1:
                return hits.pop()
            if len(hits) > 1:
                self.ambiguous.setdefault(str(raw), sorted(hits))
                return _UNMAPPED

        self.unmapped[str(raw)] = self.unmapped.get(str(raw), 0) + 1
        return _UNMAPPED

    def report(self) -> Dict[str, object]:
        """What failed to map, for the top of every run report."""
        return {
            "field": self.label,
            "unmapped_values": sorted(
                self.unmapped.items(), key=lambda kv: (-kv[1], kv[0])
            ),
            "unmapped_total_rows": sum(self.unmapped.values()),
            "ambiguous_values": self.ambiguous,
        }


def build_normalizers(cfg) -> Dict[str, Normalizer]:
    return {
        "carrier": Normalizer(cfg.carriers.get("canonical", {}), "carrier"),
        "trade": Normalizer(cfg.trades.get("trades", {}), "trade"),
        "material": Normalizer(cfg.trades.get("materials", {}), "material"),
    }


def normalize_person(raw: object) -> str:
    """Canonicalise an appraiser name.

    Handles "Last, First" -> "First Last", collapses whitespace, strips titles and
    trailing credentials. Two spellings of the same person split their claim count
    in half, which is exactly the small-n problem the scorecard is trying to avoid.
    """
    if raw is None:
        return ""
    text = re.sub(r"\s+", " ", str(raw)).strip()
    if not text:
        return ""

    text = re.sub(r"\b(mr|mrs|ms|dr)\.?\s+", "", text, flags=re.IGNORECASE)
    text = re.sub(
        r"[,\s]+(jr|sr|ii|iii|iv|pa|pe|ha|ia|aic|sppa)\.?$", "", text, flags=re.IGNORECASE
    )

    if "," in text:
        parts = [p.strip() for p in text.split(",", 1)]
        if len(parts) == 2 and parts[0] and parts[1]:
            text = f"{parts[1]} {parts[0]}"

    return " ".join(w.capitalize() if w.islower() or w.isupper() else w
                    for w in text.split())


def match_column(header: str, aliases: Iterable[str]) -> bool:
    """Does an export header match any alias? Case/punctuation insensitive."""
    h = slug(header)
    return any(h == slug(a) for a in aliases)


def resolve_columns(headers: List[str], spec: Dict[str, List[str]]) -> Dict[str, Optional[str]]:
    """Map canonical field name -> actual header in the export (or None).

    Alias order is significant: the first alias that appears in the export wins,
    so a team can put their real header first and leave the rest as fallbacks.
    """
    resolved: Dict[str, Optional[str]] = {}
    for canonical, aliases in (spec or {}).items():
        found = None
        for alias in aliases or []:
            for header in headers:
                if match_column(header, [alias]):
                    found = header
                    break
            if found:
                break
        resolved[canonical] = found
    return resolved
