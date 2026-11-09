"""Feature flags (engineering spec §38): controlled rollout without changing
the architecture.

Environment-driven, as §37 asks - `FEATURE_<NAME>` set to `1`/`true`/`yes`/`on`
turns a flag on, `0`/`false`/`no`/`off` turns it off, and anything unset or
unrecognised falls back to the flag's default. Read on every call rather than
once at import, so a deployment change and a test's monkeypatch both take
effect without a reload.

Only flags that gate something real are registered. §38 also names advanced
astrology settings, experimental visualisation, compatibility and new
calculation engines; none of those exist yet, so none has a flag - add one
here when the feature arrives, not before.
"""

from __future__ import annotations

import os
from enum import Enum


class Flag(str, Enum):
    PATTERN_DETECTION = "pattern_detection"
    """Basic recurring-theme detection over a user's own saved questions
    (product spec §20). Advanced detection is a deferred feature and would
    get its own flag."""


#: What each flag is when the environment says nothing.
_DEFAULTS: dict[Flag, bool] = {
    Flag.PATTERN_DETECTION: True,
}

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


def is_enabled(flag: Flag) -> bool:
    raw = os.getenv(f"FEATURE_{flag.name}", "").strip().lower()
    if raw in _TRUE:
        return True
    if raw in _FALSE:
        return False
    return _DEFAULTS[flag]
