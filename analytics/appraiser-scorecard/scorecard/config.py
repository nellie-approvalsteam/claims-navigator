"""Config loading. All tunable behaviour lives in config/*.yml, not in code."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List

import yaml

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config")


def _load(name: str, config_dir: str | None = None) -> Dict[str, Any]:
    path = os.path.join(config_dir or CONFIG_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Missing config file {path}. Copy it from the repo — the pipeline "
            f"deliberately has no built-in defaults for these, so that every "
            f"threshold used in a report is one you can point at."
        )
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


@dataclass
class Config:
    columns: Dict[str, Any] = field(default_factory=dict)
    carriers: Dict[str, Any] = field(default_factory=dict)
    trades: Dict[str, Any] = field(default_factory=dict)
    settings: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, config_dir: str | None = None) -> "Config":
        return cls(
            columns=_load("columns.yml", config_dir),
            carriers=_load("carriers.yml", config_dir),
            trades=_load("trades.yml", config_dir),
            settings=_load("settings.yml", config_dir),
        )

    # -- convenience accessors -------------------------------------------------

    def get(self, *path: str, default: Any = None) -> Any:
        """Dotted lookup into settings.yml, e.g. cfg.get('scoring', 'min_claims_to_rank')."""
        node: Any = self.settings
        for key in path:
            if not isinstance(node, dict) or key not in node:
                return default
            node = node[key]
        return node

    @property
    def required_columns(self) -> Dict[str, List[str]]:
        return self.columns.get("required", {}) or {}

    @property
    def optional_columns(self) -> Dict[str, List[str]]:
        return self.columns.get("optional", {}) or {}

    @property
    def all_columns(self) -> Dict[str, List[str]]:
        merged = dict(self.required_columns)
        merged.update(self.optional_columns)
        return merged
