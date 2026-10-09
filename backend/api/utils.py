"""
Utility functions for the FUTFUT API.
"""

from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)


def safe_json_parse(value: Any) -> Optional[dict]:
    """Safely parse a JSON value, returning None if parsing fails."""
    import json
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def format_number(value: Optional[int], decimal_places: int = 2) -> str:
    """Format a number with optional decimal places and comma separator."""
    if value is None:
        return "-"
    if decimal_places == 0:
        return f"{value:,}"
    return f"{value:,.{decimal_places}f}"


def format_currency(value: Optional[int], currency: str = "€") -> str:
    """Format a currency value."""
    if value is None:
        return "-"
    if value >= 1_000_000:
        return f"{value/1_000_000:,.1f}M {currency}"
    if value >= 1_000:
        return f"{value/1_000:,.1f}K {currency}"
    return f"{value:,} {currency}"


def format_date(date_str: Optional[str]) -> str:
    """Format a date string for display."""
    if not date_str:
        return "-"
    # PostgreSQL timestamp format
    from datetime import datetime
    try:
        if isinstance(date_str, str):
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.strftime("%d/%m/%Y")
    except (ValueError, TypeError):
        pass
    return date_str


def build_response(
    success: bool = True,
    data: Any = None,
    message: str = None,
    error: str = None,
    detail: str = None,
) -> dict:
    """Build a standardized API response."""
    response = {"success": success}
    if data is not None:
        response["data"] = data
    if message:
        response["message"] = message
    if error or detail:
        response["error"] = error or detail
        response["detail"] = detail or error
    return response


class APIError(Exception):
    """Custom exception for API errors."""

    def __init__(self, message: str, status_code: int = 500, detail: str = None, details: str = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or details or message
        self.details = self.detail
        super().__init__(self.message)