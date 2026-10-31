from math import isfinite
from typing import Any

PROVIDERS = {
    "private_brand": "Private Brand",
    "jan_aushadhi": "Jan Aushadhi",
    "dava_india": "Dava India",
}
SAVINGS_PROVIDERS = {
    "jan_aushadhi": "Jan Aushadhi",
    "dava_india": "Dava India",
}


def clean_price(value: Any) -> float | None:
    if value is None:
        return None
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    if not isfinite(price) or price < 0:
        return None
    return round(price, 2)


def savings_comparison(row: dict[str, Any]) -> dict[str, Any]:
    """Compare each available alternative against the private brand price."""
    private = clean_price(row.get("private_brand_price"))
    comparisons: dict[str, dict[str, float | None]] = {}
    available: list[tuple[str, float, float]] = []

    for key in SAVINGS_PROVIDERS:
        alternative = clean_price(row.get(f"{key}_price"))
        amount = round(private - alternative, 2) if private is not None and alternative is not None else None
        percentage = (
            round((amount / private) * 100, 2)
            if amount is not None and private is not None and private > 0
            else None
        )
        comparisons[key] = {"savings_amount": amount, "savings_percentage": percentage}
        # An expensive alternative is a negative comparison, not a savings opportunity.
        if amount is not None and amount >= 0 and alternative is not None:
            available.append((key, amount, alternative))

    maximum: dict[str, Any] | None = None
    if available:
        max_amount = max(item[1] for item in available)
        winners = [item for item in available if item[1] == max_amount]
        providers = [SAVINGS_PROVIDERS[item[0]] for item in winners]
        alt_price = winners[0][2]
        maximum = {
            "provider": providers[0] if len(providers) == 1 else providers,
            "amount": max_amount,
            "percentage": round((max_amount / private) * 100, 2) if private and private > 0 else None,
            "private_brand_price": private,
            "alternative_price": alt_price,
        }

    return {
        "jan_aushadhi": comparisons["jan_aushadhi"],
        "dava_india": comparisons["dava_india"],
        "maximum_savings": maximum,
    }


def maximum_savings_opportunities(
    rows: list[dict[str, Any]], provider: str | None = None, limit: int = 10
) -> dict[str, Any]:
    """Build amount-ranked savings opportunities from catalogue records."""
    provider_keys = [provider] if provider else list(SAVINGS_PROVIDERS)
    opportunities: list[dict[str, Any]] = []
    for row in rows:
        private = clean_price(row.get("private_brand_price"))
        if private is None or private <= 0:
            continue
        for key in provider_keys:
            alternative = clean_price(row.get(f"{key}_price"))
            if alternative is None:
                continue
            amount = round(private - alternative, 2)
            if amount <= 0:
                continue
            opportunities.append({
                "medicine_id": int(row["id"]),
                "medicine_name": str(row.get("brand_name") or row.get("active_salt") or ""),
                "private_brand_price": private,
                "alternative_provider": SAVINGS_PROVIDERS[key],
                "alternative_price": alternative,
                "savings_amount": amount,
                "savings_percentage": round(amount / private * 100, 2),
            })
    opportunities.sort(key=lambda item: (-item["savings_amount"], -item["savings_percentage"], item["medicine_id"], item["alternative_provider"]))
    top_savings = opportunities[:limit]
    by_percentage = sorted(opportunities, key=lambda item: (-item["savings_percentage"], -item["savings_amount"], item["medicine_id"], item["alternative_provider"]))
    return {
        "success": True,
        "provider": provider,
        "highest_savings_amount": top_savings[0] if top_savings else None,
        "highest_savings_percentage": by_percentage[0] if by_percentage else None,
        "top_savings": top_savings,
    }


def compare_prices(row: dict[str, Any]) -> dict[str, Any]:
    prices = {
        "private_brand": clean_price(row.get("private_brand_price")),
        "jan_aushadhi": clean_price(row.get("jan_aushadhi_price")),
        "dava_india": clean_price(row.get("dava_india_price")),
    }
    available = [(key, value) for key, value in prices.items() if value is not None]
    cheapest_key, cheapest = min(available, key=lambda item: item[1]) if available else (None, None)
    private = prices["private_brand"]
    savings = round(private - cheapest, 2) if private is not None and cheapest is not None else None
    percentage = round((savings / private) * 100, 2) if savings is not None and private and private > 0 else None
    return {
        "prices": prices,
        "cheapest_provider": PROVIDERS[cheapest_key] if cheapest_key else None,
        "cheapest_price": cheapest,
        "savings": savings,
        "savings_percentage": percentage,
        "savings_comparison": savings_comparison(row),
    }
