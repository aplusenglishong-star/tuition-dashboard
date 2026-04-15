# backend/app/date_utils.py
from datetime import datetime, date
from typing import Optional

DATE_FORMAT = "%Y-%m-%d"

def parse_iso_date(s: Optional[str]) -> Optional[date]:
    """Parse a yyyy-mm-dd string into a date, or return None for falsy input."""
    if s is None or s == "":
        return None
    if isinstance(s, date):
        return s
    try:
        return datetime.strptime(s, DATE_FORMAT).date()
    except Exception:
        # allow other ISO-like input by trying fromisoformat
        try:
            return date.fromisoformat(s)
        except Exception:
            raise ValueError(f"Invalid date format, expected YYYY-MM-DD: {s!r}")


def ensure_end_after_start(start: Optional[date], end: Optional[date]) -> None:
    """Raise ValueError if end exists and is before start."""
    if start and end and end < start:
        raise ValueError("end_date must be the same as or after start_date.")
