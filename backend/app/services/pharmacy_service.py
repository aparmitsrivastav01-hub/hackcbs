from __future__ import annotations

import asyncio
import math
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import parse_qs, quote, urlparse
from uuid import uuid4
from typing import Any


from app.models.pharmacy_schemas import NearbyPharmaciesRequest
from app.services.cart_service import CartService
from app.services.tinyfish_service import TinyFishError, TinyFishNotConfigured, TinyFishService

PROVIDER_NAMES = {"jan_aushadhi": "Jan Aushadhi Kendra", "dava_india": "Dava India pharmacy"}
EARTH_RADIUS_KM = 6371.0088


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    values = (lat1, lon1, lat2, lon2)
    if not all(math.isfinite(float(value)) for value in values):
        raise ValueError("Coordinates must be finite numbers")
    if not (-90 <= lat1 <= 90 and -90 <= lat2 <= 90 and -180 <= lon1 <= 180 and -180 <= lon2 <= 180):
        raise ValueError("Coordinates are outside valid latitude/longitude ranges")
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi, delta_lambda = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    a = min(1.0, max(0.0, a))
    return round(EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


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
    # A WhatsApp contact needs a mobile-format Indian subscriber number.
    if require_mobile and digits[0] not in "6789":
        return None
    return "+91" + digits


def verified_whatsapp(phone: str | None, whatsapp_url: str | None) -> tuple[str | None, bool]:
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


class PharmacyService:
    def __init__(
        self,
        cart_service: CartService,
        tinyfish: TinyFishService | None = None,
        cache_ttl_seconds: int | None = None,
    ):
        self.cart_service = cart_service
        self.tinyfish = tinyfish or TinyFishService()
        self.cache_ttl_seconds = cache_ttl_seconds or int(os.getenv("PHARMACY_CACHE_TTL_SECONDS", "3600"))
        self._cache: dict[tuple[Any, ...], tuple[float, list[dict[str, Any]]]] = {}
        self._stores: dict[str, dict[str, Any]] = {}
        self._enquiries: dict[str, dict[str, Any]] = {}

    async def nearby(self, request: NearbyPharmaciesRequest) -> dict[str, Any]:
        location = self._location_description(request)
        cache_key = self._cache_key(request)
        cached = self._cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            stores = [dict(store) for store in cached[1]]
            for store in stores:
                self._stores[store["store_id"]] = store
            return {"success": True, "total_stores": len(stores), "stores": stores, "cached": True}

        searches = await asyncio.gather(*(
            self.tinyfish.search(f"{PROVIDER_NAMES[provider]} near {location} within {request.radius_km:g} km; official store locator or public business listing with address phone WhatsApp hours")
            for provider in request.providers
        ), return_exceptions=True)
        source_jobs: list[tuple[str, dict[str, Any]]] = []
        errors: list[BaseException] = []
        for provider, result in zip(request.providers, searches):
            if isinstance(result, BaseException):
                errors.append(result)
                continue
            for source in result[:3]:
                source_jobs.append((provider, source))
        if not source_jobs and errors:
            first = errors[0]
            if isinstance(first, TinyFishError):
                raise first
            raise TinyFishError("Pharmacy discovery failed") from first

        semaphore = asyncio.Semaphore(4)

        async def extract(provider: str, source: dict[str, Any]):
            async with semaphore:
                return await self.tinyfish.extract_stores(
                    source["url"], PROVIDER_NAMES[provider], location, request.radius_km,
                )

        extraction_results = await asyncio.gather(*(
            extract(provider, source) for provider, source in source_jobs
        ), return_exceptions=True)
        now = datetime.now(timezone.utc)
        stores: list[dict[str, Any]] = []
        for (provider, source), result in zip(source_jobs, extraction_results):
            if isinstance(result, BaseException):
                errors.append(result)
                continue
            for extracted in result:
                store = self._normalize_store(extracted, provider, source.get("url"), request, now)
                if store is not None:
                    stores.append(store)

        stores = self._deduplicate(stores)
        stores.sort(key=self._sort_key)
        self._cache[cache_key] = (time.monotonic() + self.cache_ttl_seconds, [dict(store) for store in stores])
        for store in stores:
            self._stores[store["store_id"]] = store
        # If all extraction attempts failed and none succeeded, surface a service error.
        if source_jobs and errors and not stores and len(errors) == len(extraction_results):
            raise TinyFishError("TinyFish could not extract reliable store listings") from errors[0]
        warnings = ["Some pharmacy discovery tasks failed; this result may be incomplete."] if errors else []
        return {"success": True, "total_stores": len(stores), "stores": stores, "cached": False, "warnings": warnings}

    def get_store(self, store_id: str) -> dict[str, Any] | None:
        store = self._stores.get(store_id)
        if store is None:
            return None
        age = (datetime.now(timezone.utc) - store["last_verified_at"]).total_seconds()
        return store if age <= self.cache_ttl_seconds else None

    def create_enquiry(self, store_id: str, cart_session_id: str) -> dict[str, Any]:
        store = self.get_store(store_id)
        if store is None:
            raise KeyError("Pharmacy store not found")
        cart = self.cart_service.items_for_session(cart_session_id)
        if cart is None:
            raise KeyError("Cart session not found")
        if not cart:
            raise ValueError("Cannot create an enquiry for an empty cart")
        message = self._build_message(cart)
        whatsapp_url = None
        whatsapp_number = store.get("whatsapp_number")
        if store.get("whatsapp_verified") and whatsapp_number:
            digits = whatsapp_number.lstrip("+")
            whatsapp_url = f"https://wa.me/{digits}?text={quote(message, safe='')}"
        now = datetime.now(timezone.utc)
        enquiry_id = str(uuid4())
        result = {
            "success": True,
            "enquiry_id": enquiry_id,
            "store_id": store_id,
            "store_name": store["store_name"],
            "message": message,
            "whatsapp_url": whatsapp_url,
            "phone_contact": store.get("phone_number"),
            "status": "ready_to_send",
            "user_confirmation_required": True,
            "created_at": now,
        }
        self._enquiries[enquiry_id] = dict(result)
        return dict(result)

    def get_enquiry(self, enquiry_id: str) -> dict[str, Any] | None:
        enquiry = self._enquiries.get(enquiry_id)
        return dict(enquiry) if enquiry else None

    def update_enquiry_status(self, enquiry_id: str, status: str) -> dict[str, Any] | None:
        enquiry = self._enquiries.get(enquiry_id)
        if enquiry is None:
            return None
        enquiry["status"] = status
        return dict(enquiry)

    @staticmethod
    def _location_description(request: NearbyPharmaciesRequest) -> str:
        if request.latitude is not None and request.longitude is not None:
            return f"coordinates {request.latitude:.5f}, {request.longitude:.5f}"
        return request.area or f"PIN code {request.postal_code}"

    @staticmethod
    def _cache_key(request: NearbyPharmaciesRequest) -> tuple[Any, ...]:
        return (
            round(request.latitude, 4) if request.latitude is not None else None,
            round(request.longitude, 4) if request.longitude is not None else None,
            request.postal_code,
            (request.area or "").casefold().strip(),
            round(request.radius_km, 1),
            tuple(sorted(request.providers)),
        )

    @staticmethod
    def _normalize_store(raw: dict[str, Any], provider: str, search_url: str | None, request: NearbyPharmaciesRequest, verified_at: datetime) -> dict[str, Any] | None:
        name = raw.get("store_name")
        address = raw.get("address")
        source_url = raw.get("source_url") or search_url
        if not isinstance(name, str) or not name.strip() or not isinstance(address, str) or not address.strip():
            return None
        if not TinyFishService._valid_http_url(source_url):
            return None
        latitude = raw.get("latitude")
        longitude = raw.get("longitude")
        try:
            latitude = float(latitude) if latitude is not None else None
            longitude = float(longitude) if longitude is not None else None
            if latitude is not None and (not math.isfinite(latitude) or not -90 <= latitude <= 90):
                latitude = None
            if longitude is not None and (not math.isfinite(longitude) or not -180 <= longitude <= 180):
                longitude = None
        except (TypeError, ValueError):
            latitude = longitude = None
        if (latitude is None) != (longitude is None):
            latitude = longitude = None
        distance = None
        if latitude is not None and request.latitude is not None and request.longitude is not None:
            distance = distance_km(request.latitude, request.longitude, latitude, longitude)
            if distance > request.radius_km:
                return None
        phone = normalize_indian_phone(raw.get("phone_number"))
        whatsapp_phone = normalize_indian_phone(raw.get("whatsapp_number"), require_mobile=True)
        wa_url = raw.get("whatsapp_url")
        whatsapp_number, whatsapp_is_verified = verified_whatsapp(whatsapp_phone, wa_url)
        if whatsapp_number is None:
            whatsapp_is_verified = False
        delivery = raw.get("delivery_available")
        if delivery not in {"yes", "no", "unknown"}:
            delivery = "unknown"
        store = {
            "store_id": str(uuid4()),
            "store_name": name.strip(),
            "provider": provider,
            "address": address.strip(),
            "latitude": latitude,
            "longitude": longitude,
            "distance_km": distance,
            "phone_number": phone,
            "whatsapp_number": whatsapp_number,
            "whatsapp_verified": whatsapp_is_verified,
            "opening_hours": raw.get("opening_hours") if isinstance(raw.get("opening_hours"), str) else None,
            "delivery_available": delivery,
            "source_url": source_url,
            "last_verified_at": verified_at,
        }
        return store

    @staticmethod
    def _deduplicate(stores: list[dict[str, Any]]) -> list[dict[str, Any]]:
        unique: dict[tuple[str, ...], dict[str, Any]] = {}
        for store in stores:
            key = (
                store["provider"],
                re.sub(r"\W+", " ", store["store_name"].casefold()).strip(),
                re.sub(r"\W+", " ", store["address"].casefold()).strip(),
            )
            existing = unique.get(key)
            if existing is None:
                unique[key] = store
                continue
            # Merge only observed non-null fields; prefer the existing store identity and source.
            for field, value in store.items():
                if field not in {"store_id", "provider", "last_verified_at"} and (existing.get(field) is None or existing.get(field) == "") and value not in (None, ""):
                    existing[field] = value
            if store.get("whatsapp_verified"):
                existing["whatsapp_number"] = store["whatsapp_number"]
                existing["whatsapp_verified"] = True
        return list(unique.values())

    @staticmethod
    def _sort_key(store: dict[str, Any]) -> tuple[Any, ...]:
        distance = store.get("distance_km")
        if distance is None:
            return (float("inf"), not store.get("whatsapp_verified", False), float("inf"))
        return (round(distance, 1), not store.get("whatsapp_verified", False), distance)

    @staticmethod
    def _build_message(cart: list[dict[str, Any]]) -> str:
        lines = ["Hello! I found your pharmacy through MedEasy.", "", "I would like to enquire about the following medicines:", ""]
        for index, item in enumerate(cart, start=1):
            details = [item["medicine_name"]]
            if item.get("active_salt"):
                details.append(item["active_salt"])
            if item.get("dosage_form"):
                details.append(item["dosage_form"])
            details.append(f"Quantity: {item['quantity']}")
            lines.append(f"{index}. " + " – ".join(details))
        lines.extend([
            "", "Could you please confirm:",
            "1. Are these medicines currently available in stock?",
            "2. What is the price of each medicine?",
            "3. Is home delivery available at my location?",
            "4. What are the delivery charges?",
            "5. What is the estimated delivery time?",
            "", "Please share the availability and pricing details.", "", "Thank you!", "MedEasy Customer",
        ])
        return "\n".join(lines)
