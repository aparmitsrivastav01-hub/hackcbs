"""Thin HTTP integration built from TinyFish's official Search and Agent REST docs."""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse

import httpx

TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai"
TINYFISH_AGENT_RUN_URL = "https://agent.tinyfish.ai/v1/automation/run"

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

    @staticmethod
    def _valid_http_url(value: Any) -> bool:
        if not isinstance(value, str):
            return False
        try:
            parsed = urlparse(value)
            return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
        except ValueError:
            return False
