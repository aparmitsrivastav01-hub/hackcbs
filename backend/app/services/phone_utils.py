from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse


def normalize_indian_phone(value: str | None, require_mobile: bool = False) -> str | None:
    """Normalize common Indian 10-digit numbers; reject malformed contact strings."""
    if not value or not isinstance(value, str):
        return None
    digits = "".join(re.findall(r"\d", value))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "123456789":
        return None
    # A WhatsApp contact needs a mobile-format Indian subscriber number (starts with 6, 7, 8, or 9).
    if require_mobile and digits[0] not in "6789":
        return None
    return "+91" + digits


def verified_whatsapp(phone: str | None, whatsapp_url: str | None) -> tuple[str | None, bool]:
    """Verify that a WhatsApp URL belongs to the normalized mobile phone number."""
    normalized = normalize_indian_phone(phone, require_mobile=True)
    if normalized is None or not whatsapp_url:
        return None, False
    try:
        parsed = urlparse(whatsapp_url)
        if parsed.scheme != "https" or parsed.hostname not in {"wa.me", "api.whatsapp.com"}:
            return None, False
        linked = "".join(re.findall(r"\d", parsed.path if parsed.hostname == "wa.me" else parse_qs(parsed.query).get("phone", [""])[0]))
        actual = normalized.lstrip("+")
        if not linked or linked != actual:
            return None, False
        return normalized, True
    except (ValueError, TypeError):
        return None, False
