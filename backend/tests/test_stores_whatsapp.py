import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.tinyfish_service import (
    TinyFishError,
    TinyFishNotConfigured,
    TinyFishService,
    TinyFishTimeout,
)


class FakeTinyFishContact:
    def __init__(
        self,
        search_results=None,
        extracted_data=None,
        fail=False,
        timeout=False,
    ):
        self.search_results = search_results or []
        self.extracted_data = extracted_data or {}
        self.fail = fail
        self.timeout = timeout
        self.search_calls = 0
        self.extract_calls = 0
        self.searched_queries = []
        self.extracted_urls = []

    async def search(self, query: str):
        self.search_calls += 1
        self.searched_queries.append(query)
        if self.timeout:
            raise TinyFishTimeout("TinyFish search request timed out")
        if self.fail:
            raise TinyFishError("TinyFish search request failed")
        return self.search_results

    async def extract_shop_contact(
        self,
        source_url: str,
        shop_name: str,
        shop_address: str | None = None,
        city: str | None = None,
    ):
        self.extract_calls += 1
        self.extracted_urls.append(source_url)
        if self.timeout:
            raise TinyFishTimeout("TinyFish contact extraction request timed out")
        if self.fail:
            raise TinyFishError("TinyFish contact extraction request failed")
        return self.extracted_data.get(
            source_url,
            {
                "matched_exact_shop": False,
                "phone_number": None,
                "whatsapp_number": None,
                "whatsapp_url": None,
                "is_explicit_whatsapp": False,
            },
        )

    async def discover_whatsapp_contact(
        self,
        shop_name: str,
        shop_address: str | None = None,
        city: str | None = None,
        locality: str | None = None,
        maps_url: str | None = None,
        query: str | None = None,
    ):
        # Delegates to base implementation logic using fake search and extract_shop_contact
        base = TinyFishService(api_key="fake-test-key")
        base.search = self.search
        base.extract_shop_contact = self.extract_shop_contact
        return await base.discover_whatsapp_contact(
            shop_name=shop_name,
            shop_address=shop_address,
            city=city,
            locality=locality,
            maps_url=maps_url,
            query=query,
        )


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_validation_rejects_empty_shop_name(client):
    res = client.post("/api/stores/whatsapp-contact", json={"shop_name": "   "})
    assert res.status_code == 422


def test_verified_whatsapp_discovery(client):
    fake = FakeTinyFishContact(
        search_results=[{"url": "https://janaushadhi.gov.in/store/delhi-01"}],
        extracted_data={
            "https://janaushadhi.gov.in/store/delhi-01": {
                "matched_exact_shop": True,
                "phone_number": "011-23456789",
                "whatsapp_number": "9811234567",
                "whatsapp_url": "https://wa.me/919811234567",
                "is_explicit_whatsapp": True,
                "source_type": "official_website",
            }
        },
    )
    client.app.state.pharmacy_service.tinyfish = fake
    # Reset cache for testing
    client.app.state.pharmacy_service._whatsapp_cache.clear()

    payload = {
        "shop_name": "Pradhan Mantri Bhartiya Janaushadhi Kendra",
        "shop_address": "Shop No. 4, Sector 7, Rohini, New Delhi",
        "city": "New Delhi",
        "maps_url": "https://maps.google.com/?q=Rohini",
    }
    res = client.post("/api/stores/whatsapp-contact", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["shop_name"] == payload["shop_name"]
    assert data["verification_status"] == "verified_whatsapp"
    assert data["whatsapp_number"] == "+919811234567"
    assert data["phone_number"] is not None
    assert data["confidence"] == "high"
    assert data["cached"] is False
    assert fake.search_calls >= 1

    # Second call should hit the cache!
    cached_res = client.post("/api/stores/whatsapp-contact", json=payload)
    assert cached_res.status_code == 200
    assert cached_res.json()["cached"] is True
    assert fake.search_calls == 1  # No additional search call


def test_phone_only_when_whatsapp_not_verified(client):
    fake = FakeTinyFishContact(
        search_results=[{"url": "https://apollo.test/branch-rajiv-chowk"}],
        extracted_data={
            "https://apollo.test/branch-rajiv-chowk": {
                "matched_exact_shop": True,
                "phone_number": "+91 11 45678900",
                "whatsapp_number": None,
                "whatsapp_url": None,
                "is_explicit_whatsapp": False,
                "source_type": "official_website",
            }
        },
    )
    client.app.state.pharmacy_service.tinyfish = fake
    client.app.state.pharmacy_service._whatsapp_cache.clear()

    payload = {
        "shop_name": "Apollo Pharmacy 24/7",
        "shop_address": "Ground Floor, Rajiv Chowk, New Delhi",
        "city": "New Delhi",
    }
    res = client.post("/api/stores/whatsapp-contact", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["verification_status"] == "phone_only"
    assert data["whatsapp_number"] is None
    assert data["phone_number"] == "+911145678900"
    assert data["confidence"] == "medium"
    assert "WhatsApp could not be verified" in data["message"]


def test_not_found_when_shop_does_not_match(client):
    fake = FakeTinyFishContact(
        search_results=[{"url": "https://random.test/other-shop"}],
        extracted_data={
            "https://random.test/other-shop": {
                "matched_exact_shop": False,  # Safety rule: shop mismatch must be discarded
                "phone_number": "9999999999",
                "whatsapp_number": "9999999999",
                "whatsapp_url": "https://wa.me/919999999999",
                "is_explicit_whatsapp": True,
            }
        },
    )
    client.app.state.pharmacy_service.tinyfish = fake
    client.app.state.pharmacy_service._whatsapp_cache.clear()

    res = client.post(
        "/api/stores/whatsapp-contact",
        json={"shop_name": "MedPlus Chemist", "shop_address": "Preet Vihar, Delhi"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["verification_status"] == "not_found"
    assert data["whatsapp_number"] is None
    assert data["phone_number"] is None


def test_tinyfish_unconfigured_returns_503(client):
    client.app.state.pharmacy_service.tinyfish = TinyFishService(api_key="")
    client.app.state.pharmacy_service._whatsapp_cache.clear()

    res = client.post(
        "/api/stores/whatsapp-contact",
        json={"shop_name": "Local Chemist", "city": "Delhi"},
    )
    assert res.status_code == 503
    assert "TINYFISH_API_KEY" in res.json()["detail"]


def test_tinyfish_timeout_returns_504(client):
    fake = FakeTinyFishContact(timeout=True)
    client.app.state.pharmacy_service.tinyfish = fake
    client.app.state.pharmacy_service._whatsapp_cache.clear()

    res = client.post(
        "/api/stores/whatsapp-contact",
        json={"shop_name": "Local Chemist", "city": "Delhi"},
    )
    assert res.status_code == 504


def test_tinyfish_error_returns_502(client):
    fake = FakeTinyFishContact(fail=True)
    client.app.state.pharmacy_service.tinyfish = fake
    client.app.state.pharmacy_service._whatsapp_cache.clear()

    res = client.post(
        "/api/stores/whatsapp-contact",
        json={"shop_name": "Local Chemist", "city": "Delhi"},
    )
    assert res.status_code == 502


def test_pharmacies_alias_endpoint_works(client):
    fake = FakeTinyFishContact(
        search_results=[{"url": "https://test.shop/contact"}],
        extracted_data={
            "https://test.shop/contact": {
                "matched_exact_shop": True,
                "phone_number": "9876543210",
                "whatsapp_number": "9876543210",
                "whatsapp_url": "https://wa.me/919876543210",
                "is_explicit_whatsapp": True,
            }
        },
    )
    client.app.state.pharmacy_service.tinyfish = fake
    client.app.state.pharmacy_service._whatsapp_cache.clear()

    res = client.post(
        "/api/pharmacies/whatsapp-contact",
        json={"shop_name": "Test Pharmacy", "city": "Noida"},
    )
    assert res.status_code == 200
    assert res.json()["verification_status"] == "verified_whatsapp"
