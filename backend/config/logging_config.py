"""Logging configuration: every logger writes to stdout (AGENTS.md "Logging")."""
from typing import Any


def build_logging_config(level: str) -> dict[str, Any]:
    """Build a `dictConfig` that sends all records to stdout.

    Docker collects stdout and `scripts/start.*` saves it to `logs/`, so no file
    handler is configured here.

    Args:
        level: Minimum level name for the application and Django loggers, e.g. "INFO".

    Returns:
        A dictionary suitable for Django's `LOGGING` setting.
    """
    level = level.upper()
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
        },
        "handlers": {
            "stdout": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "standard",
            },
        },
        "root": {"handlers": ["stdout"], "level": level},
        "loggers": {
            "django": {"handlers": ["stdout"], "level": level, "propagate": False},
        },
    }
