"""Logging setup.

Engineering spec §37 lists logging level as environment-driven configuration,
and §20 requires operational logs to stay separate from user content. This
module configures the former; keeping birth data and conversations out of logs
is the responsibility of each call site, which is why nothing here formats
request bodies.
"""

from __future__ import annotations

import logging
import os

#: Root logger for everything the application emits. Namespaced so the level
#: can be raised or lowered without also reconfiguring uvicorn's own loggers.
LOGGER_NAME = "celestara"

DEFAULT_LEVEL = "INFO"

_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def configure_logging(level: str | None = None) -> None:
    """Attach a stderr handler to the application logger.

    Idempotent: calling it twice will not duplicate handlers, which matters
    because uvicorn's reloader re-imports the app module on every file change.
    """
    resolved = (level or os.getenv("LOG_LEVEL") or DEFAULT_LEVEL).upper()

    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(resolved)

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(_FORMAT))
        logger.addHandler(handler)

    # Our records are emitted by our own handler; letting them bubble to the
    # root logger as well would print each line twice under uvicorn.
    logger.propagate = False
