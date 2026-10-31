"""Thin HTTP integration built from TinyFish's official Search and Agent REST docs."""
from __future__ import annotations

import logging
import os
from typing import Any
from urllib.parse import urlparse

import httpx

from app.services.phone_utils import normalize_indian_phone, verified_whatsapp

logger = logging.getLogger(__name__)

TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai"
TINYFISH_AGENT_RUN_URL = "https://agent.tinyfish.ai/v1/automation/run"

BLOCKED_OR_LOW_PRIORITY_DOMAINS = (
    "justdial.com",
    "youtube.com",
    "instagram.com",
    "pinterest.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
)


def _candidate_priority(url: str) -> int:
    """Prioritize official pharmacy websites, brand locators, and business listings over scrap-blocking directories."""
    domain = urlparse(url).netloc.lower()
    for blocked in BLOCKED_OR_LOW_PRIORITY_DOMAINS:
        if blocked in domain:
            return 10
    # Official pharmacy chains, government kendra locators, and direct business sites get top priority
    if any(k in domain for k in ("davaindia", "janaushadhi", "apollopharmacy", "medplus", "netmeds", "1mg", "pharmeasy", "business.site")):
        return 1
    if "facebook.com" in domain or "maps.google" in domain or "google.com" in domain:
        return 2
    return 5

STORE_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "stores": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "store_name": {"type": "string", "nullable": True},
                    "address": {"type": "string", "nullable": True},
                    "latitude": {"type": "number", "nullable": True},
                    "longitude": {"type": "number", "nullable": True},
                    "phone_number": {"type": "string", "nullable": True},
                    "whatsapp_number": {"type": "string", "nullable": True},
                    "whatsapp_url": {"type": "string", "nullable": True},
                    "opening_hours": {"type": "string", "nullable": True},
                    "delivery_available": {"type": "string", "enum": ["yes", "no", "unknown"]},
                    "source_url": {"type": "string", "nullable": True},
                },
                "required": [
                    "store_name", "address", "latitude", "longitude", "phone_number",
                    "whatsapp_number", "whatsapp_url", "opening_hours", "delivery_available", "source_url",
                ],
            },
        }
    },
    "required": ["stores"],
}

WHATSAPP_CONTACT_SCHEMA = {
    "type": "object",
    "properties": {
        "matched_exact_shop": {"type": "boolean"},
        "phone_number": {"type": "string", "nullable": True},
        "whatsapp_number": {"type": "string", "nullable": True},
        "whatsapp_url": {"type": "string", "nullable": True},
        "is_explicit_whatsapp": {"type": "boolean"},
        "source_type": {
            "type": "string",
            "enum": ["official_website", "google_business", "social_media", "public_directory", "unknown"],
        },
        "confidence": {
            "type": "string",
            "enum": ["high", "medium", "low", "none"],
        },
        "notes": {"type": "string", "nullable": True},
    },
    "required": [
        "matched_exact_shop",
        "phone_number",
        "whatsapp_number",
        "whatsapp_url",
        "is_explicit_whatsapp",
    ],
}


class TinyFishError(RuntimeError):
    pass


class TinyFishNotConfigured(TinyFishError):
    pass


class TinyFishTimeout(TinyFishError):
    pass


class TinyFishService:
    def __init__(
        self,
        api_key: str | None = None,
        search_timeout_seconds: float = 15,
        agent_timeout_seconds: float = 75,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.api_key = api_key if api_key is not None else os.getenv("TINYFISH_API_KEY")
        self.search_timeout_seconds = search_timeout_seconds
        self.agent_timeout_seconds = agent_timeout_seconds
        self.transport = transport

    def _headers(self) -> dict[str, str]:
        if not self.api_key:
            raise TinyFishNotConfigured("Pharmacy discovery is unavailable: TINYFISH_API_KEY is not configured")
        return {"X-API-Key": self.api_key, "Accept": "application/json"}

    async def search(self, query: str) -> list[dict[str, Any]]:
        headers = self._headers()
        try:
            async with httpx.AsyncClient(timeout=self.search_timeout_seconds, transport=self.transport) as client:
                response = await client.get(
                    TINYFISH_SEARCH_URL,
                    headers=headers,
                    params={
                        "query": query,
                        "location": "IN",
                        "language": "en",
                        "purpose": "Find publicly listed pharmacy locations with reliable source URLs; do not infer contact details.",
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.TimeoutException as exc:
            raise TinyFishTimeout("TinyFish search request timed out") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise TinyFishError("TinyFish search request failed") from exc
        results = payload.get("results", []) if isinstance(payload, dict) else []
        if not isinstance(results, list):
            raise TinyFishError("TinyFish returned an invalid search response")
        return [item for item in results if isinstance(item, dict) and self._valid_http_url(item.get("url"))][:5]

    async def extract_stores(self, source_url: str, provider_name: str, location_description: str, radius_km: float) -> list[dict[str, Any]]:
        if not self._valid_http_url(source_url):
            return []
        headers = self._headers()
        goal = (
            f"Inspect this public page for {provider_name} pharmacy store listings relevant to {location_description} "
            f"within approximately {radius_km:g} km. Return up to five stores that the page actually identifies. "
            "Do not invent or infer names, addresses, coordinates, opening hours, phone numbers, WhatsApp support, "
            "or delivery. Return null when a field is not explicitly published. Extract latitude and longitude only "
            "when the page or a clearly linked public listing provides coordinates. Return a WhatsApp URL only when "
            "the page actually links to that business WhatsApp contact. Set delivery_available to yes/no only when "
            "the source explicitly says so; otherwise unknown. Include the direct source page URL for each store. "
            "Return {\"stores\":[]} if no reliable listing is present."
        )
        payload = {
            "url": source_url,
            "goal": goal,
            "output_schema": STORE_OUTPUT_SCHEMA,
            "agent_config": {"max_duration_seconds": 55},
        }
        try:
            async with httpx.AsyncClient(timeout=self.agent_timeout_seconds, transport=self.transport) as client:
                response = await client.post(TINYFISH_AGENT_RUN_URL, headers={**headers, "Content-Type": "application/json"}, json=payload)
                response.raise_for_status()
                result_body = response.json()
        except httpx.TimeoutException as exc:
            raise TinyFishTimeout("TinyFish extraction request timed out") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise TinyFishError("TinyFish extraction request failed") from exc
        if not isinstance(result_body, dict) or result_body.get("status") != "COMPLETED":
            raise TinyFishError("TinyFish extraction did not complete")
        extracted = result_body.get("result")
        if isinstance(extracted, dict) and isinstance(extracted.get("result"), dict):
            extracted = extracted["result"]
        stores = extracted.get("stores", []) if isinstance(extracted, dict) else []
        if not isinstance(stores, list):
            raise TinyFishError("TinyFish returned an invalid extraction response")
        return [store for store in stores if isinstance(store, dict)]

    async def extract_shop_contact(
        self,
        source_url: str,
        shop_name: str,
        shop_address: str | None = None,
        city: str | None = None,
    ) -> dict[str, Any]:
        if not self._valid_http_url(source_url):
            return {}
        headers = self._headers()
        location_desc = f" at {shop_address}" if shop_address else (f" in {city}" if city else "")
        goal = (
            f"Inspect this public page for official contact details of the pharmacy named '{shop_name}'{location_desc}. "
            "1. matched_exact_shop: Set to true ONLY if this page is genuinely for this exact pharmacy shop and location. "
            "If it is for a different pharmacy or another city, set to false. "
            "2. whatsapp_number & whatsapp_url: Extract ONLY if this page explicitly labels or links a WhatsApp contact "
            "(e.g. wa.me link or explicit 'WhatsApp: ...'). A phone number alone is NOT proof of WhatsApp availability. "
            "3. phone_number: Extract general telephone/mobile contact published for this shop. "
            "4. is_explicit_whatsapp: Set to true if the number or link is explicitly confirmed as WhatsApp on the page; otherwise false. "
            "5. Never invent or guess numbers. Return null when not explicitly found."
        )
        payload = {
            "url": source_url,
            "goal": goal,
            "output_schema": WHATSAPP_CONTACT_SCHEMA,
            "browser_profile": "lite",
            "agent_config": {"max_duration_seconds": 55},
        }
        logger.info("TinyFish extraction starting on URL: %s for shop: %s", source_url, shop_name)
        try:
            async with httpx.AsyncClient(timeout=self.agent_timeout_seconds, transport=self.transport) as client:
                response = await client.post(
                    TINYFISH_AGENT_RUN_URL,
                    headers={**headers, "Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
                result_body = response.json()
        except httpx.TimeoutException as exc:
            logger.warning("TinyFish contact extraction timed out on %s: %s", source_url, type(exc).__name__)
            raise TinyFishTimeout("TinyFish contact extraction request timed out") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("TinyFish contact extraction HTTP error on %s: %s", source_url, type(exc).__name__)
            raise TinyFishError("TinyFish contact extraction request failed") from exc

        status = result_body.get("status") if isinstance(result_body, dict) else None
        logger.info("TinyFish task response status: %s (run_id=%s)", status, result_body.get("run_id") if isinstance(result_body, dict) else None)
        if not isinstance(result_body, dict) or status != "COMPLETED":
            raise TinyFishError("TinyFish contact extraction did not complete")
        extracted = result_body.get("result")
        if isinstance(extracted, dict) and isinstance(extracted.get("result"), dict):
            extracted = extracted["result"]
        return extracted if isinstance(extracted, dict) else {}

    async def discover_whatsapp_contact(
        self,
        shop_name: str,
        shop_address: str | None = None,
        city: str | None = None,
        locality: str | None = None,
        maps_url: str | None = None,
        query: str | None = None,
    ) -> dict[str, Any]:
        """Search publicly accessible sources via TinyFish and extract verified contact."""
        logger.info(
            "TinyFish WhatsApp discovery initiated: shop='%s', address='%s', city='%s', maps_url='%s'",
            shop_name, shop_address or "", city or locality or "", maps_url or "",
        )
        location_part = shop_address or locality or city or ""
        search_query = (
            query.strip()
            if query and query.strip()
            else f"{shop_name} {location_part} pharmacy official contact phone whatsapp website".strip()
        )

        candidate_urls: list[str] = []
        if maps_url and self._valid_http_url(maps_url):
            candidate_urls.append(maps_url)

        try:
            search_results = await self.search(search_query)
            for res in search_results:
                url = res.get("url")
                if url and self._valid_http_url(url) and url not in candidate_urls:
                    candidate_urls.append(url)
        except TinyFishTimeout:
            raise
        except TinyFishError:
            if not candidate_urls:
                raise

        if not candidate_urls:
            logger.info("TinyFish search returned 0 candidates for query: %s", search_query)
            return {
                "shop_name": shop_name,
                "phone_number": None,
                "whatsapp_number": None,
                "source_url": None,
                "verification_status": "not_found",
                "confidence": "none",
                "message": "No public listings found for this shop.",
            }

        # Sort candidate URLs to prioritize official brand locators and sites over bot-blocking directories
        candidate_urls.sort(key=_candidate_priority)
        logger.info("TinyFish search found %d candidates for '%s'. Top candidates: %s", len(candidate_urls), shop_name, candidate_urls[:3])

        candidate_urls = candidate_urls[:2]

        found_phone: str | None = None
        phone_source_url: str | None = None
        has_ambiguous_candidate = False
        errors: list[Exception] = []

        for candidate_url in candidate_urls:
            try:
                extracted = await self.extract_shop_contact(
                    source_url=candidate_url,
                    shop_name=shop_name,
                    shop_address=shop_address,
                    city=city or locality,
                )
            except (TinyFishError, TinyFishTimeout) as exc:
                errors.append(exc)
                continue

            matched = bool(extracted.get("matched_exact_shop"))
            notes = str(extracted.get("notes") or "").lower()
            logger.info(
                "TinyFish extraction completed on %s: matched=%s, has_phone=%s, is_explicit_wa=%s, notes='%s'",
                candidate_url, matched, bool(extracted.get("phone_number")), extracted.get("is_explicit_whatsapp"), notes[:80],
            )

            if not matched:
                if any(w in notes for w in ("ambiguous", "multiple", "different branch", "another store", "differ")):
                    has_ambiguous_candidate = True
                continue

            raw_wa = extracted.get("whatsapp_number")
            raw_wa_url = extracted.get("whatsapp_url")
            is_explicit_wa = bool(extracted.get("is_explicit_whatsapp"))
            raw_phone = extracted.get("phone_number")

            norm_wa = normalize_indian_phone(raw_wa, require_mobile=True) if raw_wa else None
            norm_phone = normalize_indian_phone(raw_phone, require_mobile=False) if raw_phone else None

            # Priority: explicit WhatsApp contact
            if raw_wa_url:
                verified_num, is_wa = verified_whatsapp(norm_wa or raw_phone, raw_wa_url)
                if is_wa and verified_num:
                    result = {
                        "shop_name": shop_name,
                        "phone_number": norm_phone or verified_num,
                        "whatsapp_number": verified_num,
                        "source_url": candidate_url,
                        "verification_status": "verified_whatsapp",
                        "confidence": "high",
                        "message": "Verified WhatsApp number found.",
                    }
                    logger.info("Verified WhatsApp contact found: shop='%s', wa=%s, source=%s", shop_name, verified_num, candidate_url)
                    return result

            if is_explicit_wa and norm_wa:
                result = {
                    "shop_name": shop_name,
                    "phone_number": norm_phone or norm_wa,
                    "whatsapp_number": norm_wa,
                    "source_url": candidate_url,
                    "verification_status": "verified_whatsapp",
                    "confidence": "high",
                    "message": "Verified WhatsApp number found.",
                }
                logger.info("Verified explicit WhatsApp contact found: shop='%s', wa=%s, source=%s", shop_name, norm_wa, candidate_url)
                return result

            if not found_phone and norm_phone:
                found_phone = norm_phone
                phone_source_url = candidate_url

        if not found_phone and errors and len(errors) == len(candidate_urls):
            # All extraction calls failed
            first_err = errors[0]
            if isinstance(first_err, (TinyFishError, TinyFishTimeout)):
                raise first_err

        if found_phone:
            result = {
                "shop_name": shop_name,
                "phone_number": found_phone,
                "whatsapp_number": None,
                "source_url": phone_source_url,
                "verification_status": "phone_only",
                "confidence": "medium",
                "message": "Public phone number found, but WhatsApp could not be verified for this shop.",
            }
            logger.info("Phone-only contact found: shop='%s', phone=%s, source=%s", shop_name, found_phone, phone_source_url)
            return result

        if has_ambiguous_candidate:
            result = {
                "shop_name": shop_name,
                "phone_number": None,
                "whatsapp_number": None,
                "source_url": candidate_urls[0] if candidate_urls else None,
                "verification_status": "ambiguous",
                "confidence": "low",
                "message": "Multiple or ambiguous shop matches found. Please specify the exact branch or street address.",
            }
            logger.info("Ambiguous shop matches found for shop='%s'", shop_name)
            return result

        result = {
            "shop_name": shop_name,
            "phone_number": None,
            "whatsapp_number": None,
            "source_url": candidate_urls[0] if candidate_urls else None,
            "verification_status": "not_found",
            "confidence": "none",
            "message": "WhatsApp number could not be verified for this shop.",
        }
        logger.info("No contact found for shop='%s'", shop_name)
        return result

    @staticmethod
    def _valid_http_url(value: Any) -> bool:
        if not isinstance(value, str):
            return False
        try:
            parsed = urlparse(value)
            return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
        except ValueError:
            return False
