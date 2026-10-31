from typing import Any
from uuid import uuid4

from app.services.medicine_service import MedicineService
from app.services.price_service import compare_prices

PROVIDER_PRICE_FIELDS = {
    "jan_aushadhi": "jan_aushadhi",
    "dava_india": "dava_india",
    "private_brand": "private_brand",
}


class CartService:
    """Temporary cart storage keyed by a client-generated session identifier."""

    def __init__(self, medicine_service: MedicineService):
        self.medicine_service = medicine_service
        self._carts: dict[str, list[dict[str, Any]]] = {}

    def add(self, medicine_id: int, quantity: int, provider: str, session_id: str | None = None) -> dict[str, Any]:
        row = self.medicine_service.get(medicine_id)
        if row is None:
            raise KeyError("Medicine not found")
        prices = compare_prices(row)["prices"]
        price = prices[PROVIDER_PRICE_FIELDS[provider]]
        if price is None:
            raise ValueError(f"{provider} price is unavailable for this medicine")
        session_id = session_id or str(uuid4())
        items = self._carts.setdefault(session_id, [])
        existing = next((item for item in items if item["medicine_id"] == medicine_id), None)
        if existing:
            existing["quantity"] += quantity
            existing["selected_provider"] = provider
            self._reprice(existing, row, prices[PROVIDER_PRICE_FIELDS[provider]])
            item = existing
        else:
            item = {
                "item_id": str(uuid4()),
                "medicine_id": medicine_id,
                "medicine_name": row["brand_name"],
                "active_salt": row["active_salt"],
                "dosage_form": row["dosage_form"],
                "quantity": quantity,
                "selected_provider": provider,
                "unit_price": price,
                "subtotal": round(price * quantity, 2),
                "private_brand_unit_price": prices["private_brand"],
                "potential_savings": self._item_savings(prices["private_brand"], price, quantity),
            }
            items.append(item)
        return self.get(session_id)

    def get(self, session_id: str) -> dict[str, Any]:
        items = self._carts.get(session_id, [])
        private_total = None if any(item["private_brand_unit_price"] is None for item in items) else round(sum(item["private_brand_unit_price"] * item["quantity"] for item in items), 2)
        potential_savings = None if any(item["potential_savings"] is None for item in items) else round(sum(item["potential_savings"] for item in items), 2)
        return {
            "success": True,
            "cart_session_id": session_id,
            "items": [dict(item) for item in items],
            "line_item_count": len(items),
            "total_quantity": sum(item["quantity"] for item in items),
            "subtotal": round(sum(item["subtotal"] for item in items), 2),
            "private_brand_subtotal": private_total,
            "potential_savings": potential_savings,
        }

    def update(self, session_id: str, item_id: str, quantity: int | None, provider: str | None) -> dict[str, Any]:
        items = self._carts.get(session_id)
        if items is None:
            raise KeyError("Cart session not found")
        item = next((candidate for candidate in items if candidate["item_id"] == item_id), None)
        if item is None:
            raise KeyError("Cart item not found")
        row = self.medicine_service.get(item["medicine_id"])
        new_provider = provider or item["selected_provider"]
        prices = compare_prices(row)["prices"]
        new_price = prices[PROVIDER_PRICE_FIELDS[new_provider]]
        if new_price is None:
            raise ValueError(f"{new_provider} price is unavailable for this medicine")
        if quantity is not None:
            item["quantity"] = quantity
        item["selected_provider"] = new_provider
        self._reprice(item, row, new_price)
        return self.get(session_id)

    def remove(self, session_id: str, item_id: str) -> dict[str, Any]:
        items = self._carts.get(session_id)
        if items is None:
            raise KeyError("Cart session not found")
        remaining = [item for item in items if item["item_id"] != item_id]
        if len(remaining) == len(items):
            raise KeyError("Cart item not found")
        self._carts[session_id] = remaining
        return self.get(session_id)

    def clear(self, session_id: str) -> dict[str, Any]:
        self._carts[session_id] = []
        return self.get(session_id)

    def items_for_session(self, session_id: str) -> list[dict[str, Any]] | None:
        items = self._carts.get(session_id)
        return [dict(item) for item in items] if items is not None else None

    def _reprice(self, item: dict[str, Any], row: dict[str, Any], unit_price: float) -> None:
        prices = compare_prices(row)["prices"]
        item["unit_price"] = unit_price
        item["subtotal"] = round(unit_price * item["quantity"], 2)
        item["private_brand_unit_price"] = prices["private_brand"]
        item["potential_savings"] = self._item_savings(prices["private_brand"], unit_price, item["quantity"])

    @staticmethod
    def _item_savings(private_price: float | None, selected_price: float, quantity: int) -> float | None:
        if private_price is None:
            return None
        return round(max(0, private_price - selected_price) * quantity, 2)
