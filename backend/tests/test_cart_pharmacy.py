from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app, medicine_service
from app.models.pharmacy_schemas import NearbyPharmaciesRequest
from app.services.cart_service import CartService
from app.services.medicine_service import MedicineService
from app.services.pharmacy_service import PharmacyService, distance_km, normalize_indian_phone, verified_whatsapp
from app.services.tinyfish_service import (
    TINYFISH_AGENT_RUN_URL,
    TINYFISH_SEARCH_URL,
    TinyFishError,
    TinyFishNotConfigured,
    TinyFishService,
)

CSV = Path(__file__).parents[1] / "app" / "data" / "MedEasy_catalogue_500_complete.csv"


class FakeTinyFish:
    def __init__(self, sources=None, records=None, fail=False):
        self.sources = sources or {}
        self.records = records or {}
        self.fail = fail
        self.search_calls = 0
        self.extract_calls = 0
        self.queries = []

    async def search(self, query):
        self.search_calls += 1
        self.queries.append(query)
        if self.fail:
            raise TinyFishError("TinyFish search request failed")
        provider = "jan_aushadhi" if "Jan Aushadhi" in query else "dava_india"
        return self.sources.get(provider, [])

    async def extract_stores(self, source_url, provider_name, location_description, radius_km):
        self.extract_calls += 1
        if self.fail:
            raise TinyFishError("TinyFish extraction request failed")
        return self.records.get(source_url, [])


def sample_store(name, address, lat, lon, phone="9876543210", whatsapp=True, delivery="unknown"):
    return {
        "store_name": name,
        "address": address,
        "latitude": lat,
        "longitude": lon,
        "phone_number": phone,
        "whatsapp_number": phone if whatsapp else None,
        "whatsapp_url": f"https://wa.me/91{phone}" if whatsapp else None,
        "opening_hours": "10:00–20:00" if name else None,
        "delivery_available": delivery,
        "source_url": None,
    }


@pytest.fixture(scope="module", autouse=True)
def load_catalogue():
    medicine_service.load_csv(CSV)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_add_medicine_to_cart_and_subtotal(client):
    response = client.post("/api/cart/add", json={"medicine_id": 1, "quantity": 2, "selected_provider": "jan_aushadhi"})
    assert response.status_code == 201
    cart = response.json()
    assert cart["items"][0]["medicine_name"] == "Zerodol-P"
    assert cart["items"][0]["unit_price"] == 5.7
    assert cart["items"][0]["subtotal"] == 11.4
    assert cart["subtotal"] == 11.4
    assert cart["private_brand_subtotal"] == 137.0
    assert cart["potential_savings"] == 125.6
    assert cart["total_quantity"] == 2


def test_duplicate_cart_entry_merges_quantity(client):
    added = client.post("/api/cart/add", json={"medicine_id": 1, "quantity": 1, "selected_provider": "jan_aushadhi"}).json()
    session = added["cart_session_id"]
    repeated = client.post("/api/cart/add", json={"medicine_id": 1, "quantity": 2, "selected_provider": "dava_india", "cart_session_id": session}).json()
    assert repeated["line_item_count"] == 1
    assert repeated["items"][0]["quantity"] == 3
    assert repeated["items"][0]["selected_provider"] == "dava_india"
    assert repeated["items"][0]["subtotal"] == 43.5


def test_update_quantity_and_provider_reprices_cart(client):
    added = client.post("/api/cart/add", json={"medicine_id": 1, "quantity": 1, "selected_provider": "jan_aushadhi"}).json()
    item_id = added["items"][0]["item_id"]
    updated = client.put(f"/api/cart/update/{item_id}", json={"cart_session_id": added["cart_session_id"], "quantity": 3, "selected_provider": "private_brand"})
    assert updated.status_code == 200
    item = updated.json()["items"][0]
    assert item["unit_price"] == 68.5
    assert item["subtotal"] == 205.5
    assert item["potential_savings"] == 0


def test_remove_and_clear_cart(client):
    added = client.post("/api/cart/add", json={"medicine_id": 1, "quantity": 1, "selected_provider": "jan_aushadhi"}).json()
    session = added["cart_session_id"]
    item_id = added["items"][0]["item_id"]
    removed = client.delete(f"/api/cart/remove/{item_id}", params={"cart_session_id": session})
    assert removed.status_code == 200
    assert removed.json()["items"] == []
    client.post("/api/cart/add", json={"medicine_id": 1, "quantity": 1, "selected_provider": "jan_aushadhi", "cart_session_id": session})
    cleared = client.delete("/api/cart/clear", params={"cart_session_id": session})
    assert cleared.status_code == 200
    assert cleared.json()["subtotal"] == 0


def test_cart_missing_medicine_and_missing_price(client):
    assert client.post("/api/cart/add", json={"medicine_id": 9999999, "selected_provider": "jan_aushadhi"}).status_code == 404
    local = MedicineService()
    row = {"id": 701, "brand_name": "No Price", "active_salt": "Unknown", "dosage_form": "Tablet", "category": "Test", "private_brand_price": None, "jan_aushadhi_price": None, "dava_india_price": 1.0}
    local._rows = [row]; local._by_id = {701: row}
    with pytest.raises(ValueError, match="unavailable"):
        CartService(local).add(701, 1, "jan_aushadhi")


def test_cart_session_is_required_for_get(client):
    assert client.get("/api/cart").status_code == 422


def test_haversine_distance_calculation():
    assert distance_km(0, 0, 0, 0) == 0
    assert 1.1 < distance_km(26.85, 80.95, 26.86, 80.95) < 1.2
    with pytest.raises(ValueError):
        distance_km(91, 0, 0, 0)


def test_phone_normalization_and_whatsapp_validation():
    assert normalize_indian_phone("+91 98765 43210") == "+919876543210"
    assert normalize_indian_phone("not a phone") is None
    assert normalize_indian_phone("123") is None
    assert verified_whatsapp("9876543210", "https://wa.me/919876543210") == ("+919876543210", True)
    assert verified_whatsapp("9876543210", "https://example.com/919876543210") == (None, False)
    assert verified_whatsapp("9876543210", "https://wa.me/911234567890") == (None, False)


def test_nearby_search_deduplicates_and_sorts(client):
    fake = FakeTinyFish(
        sources={
            "jan_aushadhi": [{"url": "https://listing.test/jan"}, {"url": "https://listing.test/jan-copy"}],
            "dava_india": [{"url": "https://listing.test/dava"}],
        },
        records={
            "https://listing.test/jan": [sample_store("Jan Aushadhi Kendra", "1 Main Road, Lucknow", 26.86, 80.95)],
            "https://listing.test/jan-copy": [sample_store("Jan Aushadhi Kendra", "1 Main Road, Lucknow", 26.86, 80.95, whatsapp=False)],
            "https://listing.test/dava": [sample_store("Dava India", "2 Main Road, Lucknow", 26.86, 80.95, "9123456789", whatsapp=False)],
        },
    )
    client.app.state.pharmacy_service.tinyfish = fake
    response = client.post("/api/pharmacies/nearby", json={"latitude": 26.85, "longitude": 80.95, "radius_km": 10, "providers": ["jan_aushadhi", "dava_india"]})
    assert response.status_code == 200
    result = response.json()
    assert result["total_stores"] == 2
    assert [item["provider"] for item in result["stores"]] == ["jan_aushadhi", "dava_india"]
    jan = result["stores"][0]
    assert jan["distance_km"] is not None
    assert jan["whatsapp_verified"] is True
    assert jan["source_url"] == "https://listing.test/jan"
    assert fake.search_calls == 2
    assert fake.extract_calls == 3


def test_nearby_discovery_cache(client):
    fake = FakeTinyFish(sources={"jan_aushadhi": [{"url": "https://listing.test/one"}]}, records={"https://listing.test/one": [sample_store("Jan Kendra", "1 Test Road", 26.851, 80.95)]})
    client.app.state.pharmacy_service.tinyfish = fake
    body = {"latitude": 26.85, "longitude": 80.95, "providers": ["jan_aushadhi"]}
    assert client.post("/api/pharmacies/nearby", json=body).json()["cached"] is False
    cached = client.post("/api/pharmacies/nearby", json=body).json()
    assert cached["cached"] is True
    assert fake.search_calls == 1


def test_nearby_area_and_postal_code_inputs(client):
    fake = FakeTinyFish()
    client.app.state.pharmacy_service.tinyfish = fake
    assert client.post("/api/pharmacies/nearby", json={"area": "Hazratganj, Lucknow", "providers": ["jan_aushadhi"]}).status_code == 200
    assert client.post("/api/pharmacies/nearby", json={"postal_code": "226001", "providers": ["dava_india"]}).status_code == 200
    assert client.post("/api/pharmacies/nearby", json={"latitude": 26.85, "providers": ["jan_aushadhi"]}).status_code == 422
    assert client.post("/api/pharmacies/nearby", json={"postal_code": "123", "providers": ["jan_aushadhi"]}).status_code == 422


def test_no_whatsapp_number_keeps_phone_contact_only(client):
    fake = FakeTinyFish(sources={"jan_aushadhi": [{"url": "https://listing.test/no-wa"}]}, records={"https://listing.test/no-wa": [sample_store("Jan Kendra", "1 Test Road", 26.851, 80.95, whatsapp=False)]})
    client.app.state.pharmacy_service.tinyfish = fake
    result = client.post("/api/pharmacies/nearby", json={"latitude": 26.85, "longitude": 80.95, "providers": ["jan_aushadhi"]}).json()
    assert result["stores"][0]["whatsapp_number"] is None
    assert result["stores"][0]["whatsapp_verified"] is False
    assert result["stores"][0]["phone_number"] == "+919876543210"


def test_tinyfish_failure_returns_502(client):
    client.app.state.pharmacy_service.tinyfish = FakeTinyFish(fail=True)
    response = client.post("/api/pharmacies/nearby", json={"area": "Hazratganj, Lucknow", "providers": ["jan_aushadhi"]})
    assert response.status_code == 502
    assert "TinyFish" in response.json()["detail"]


def test_tinyfish_missing_key_fails_clearly():
    service = TinyFishService(api_key="")
    with pytest.raises(TinyFishNotConfigured):
        import asyncio
        asyncio.run(service.search("pharmacy near me"))


def test_tinyfish_api_uses_documented_search_and_agent_contract():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-Key"] == "unit-test-key"
        if str(request.url) == TINYFISH_SEARCH_URL or request.url.host == "api.search.tinyfish.ai":
            assert request.method == "GET"
            assert request.url.params["query"] == "Jan Aushadhi Kendra near Lucknow"
            return httpx.Response(200, json={"results": [{"url": "https://source.test/store"}]})
        assert request.url.host == "agent.tinyfish.ai"
        assert request.url.path == "/v1/automation/run"
        assert request.method == "POST"
        payload = __import__("json").loads(request.content)
        assert payload["url"] == "https://source.test/store"
        assert "output_schema" in payload and "goal" in payload
        return httpx.Response(200, json={"status": "COMPLETED", "result": {"stores": [{"store_name": "Test", "address": "Road", "source_url": "https://source.test/store"}]}})

    transport = httpx.MockTransport(handler)
    service = TinyFishService(api_key="unit-test-key", transport=transport)
    import asyncio
    results = asyncio.run(service.search("Jan Aushadhi Kendra near Lucknow"))
    stores = asyncio.run(service.extract_stores(results[0]["url"], "Jan Aushadhi Kendra", "Lucknow", 10))
    assert stores[0]["store_name"] == "Test"


def test_tinyfish_http_failure_is_sanitized():
    transport = httpx.MockTransport(lambda request: httpx.Response(401, json={"error": "secret detail"}))
    service = TinyFishService(api_key="unit-test-key", transport=transport)
    import asyncio
    with pytest.raises(TinyFishError, match="search request failed") as exc:
        asyncio.run(service.search("pharmacy"))
    assert "secret detail" not in str(exc.value)


def test_create_whatsapp_enquiry_and_track_status(client):
    fake = FakeTinyFish(sources={"jan_aushadhi": [{"url": "https://listing.test/wa"}]}, records={"https://listing.test/wa": [sample_store("Jan Kendra", "1 Test Road", 26.851, 80.95)]})
    client.app.state.pharmacy_service.tinyfish = fake
    store_result = client.post("/api/pharmacies/nearby", json={"latitude": 26.85, "longitude": 80.95, "providers": ["jan_aushadhi"]}).json()
    store = store_result["stores"][0]
    cart = client.post("/api/cart/add", json={"medicine_id": 1, "quantity": 2, "selected_provider": "jan_aushadhi"}).json()
    created = client.post("/api/pharmacies/enquiry/create", json={"store_id": store["store_id"], "cart_session_id": cart["cart_session_id"]})
    assert created.status_code == 201
    enquiry = created.json()
    assert enquiry["status"] == "ready_to_send"
    assert enquiry["user_confirmation_required"] is True
    assert "Zerodol-P" in enquiry["message"] and "Quantity: 2" in enquiry["message"]
    assert "patient" not in enquiry["message"].lower()
    parsed = urlparse(enquiry["whatsapp_url"])
    assert parsed.netloc == "wa.me"
    assert parse_qs(parsed.query)["text"][0] == enquiry["message"]
    assert client.get(f"/api/pharmacies/enquiry/{enquiry['enquiry_id']}").status_code == 200
    patched = client.patch(f"/api/pharmacies/enquiry/{enquiry['enquiry_id']}/status", json={"status": "user_opened_whatsapp"})
    assert patched.status_code == 200
    assert patched.json()["status"] == "user_opened_whatsapp"
    assert "sent" not in patched.json()["status"]


def test_multiple_pharmacy_enquiries_are_independent(client):
    fake = FakeTinyFish(
        sources={"jan_aushadhi": [{"url": "https://listing.test/a"}], "dava_india": [{"url": "https://listing.test/b"}]},
        records={
            "https://listing.test/a": [sample_store("Jan Kendra", "1 Road", 26.851, 80.95)],
            "https://listing.test/b": [sample_store("Dava Store", "2 Road", 26.852, 80.95, "9123456789", whatsapp=False)],
        },
    )
    client.app.state.pharmacy_service.tinyfish = fake
    found = client.post("/api/pharmacies/nearby", json={"latitude": 26.85, "longitude": 80.95}).json()
    cart = client.post("/api/cart/add", json={"medicine_id": 1, "selected_provider": "jan_aushadhi"}).json()
    enquiries = [
        client.post("/api/pharmacies/enquiry/create", json={"store_id": store["store_id"], "cart_session_id": cart["cart_session_id"]}).json()
        for store in found["stores"]
    ]
    assert len(enquiries) == 2
    assert enquiries[0]["enquiry_id"] != enquiries[1]["enquiry_id"]
    assert enquiries[1]["whatsapp_url"] is None
    assert enquiries[1]["phone_contact"] is not None


def test_enquiry_rejects_invalid_store_and_empty_cart(client):
    assert client.post("/api/pharmacies/enquiry/create", json={"store_id": "unknown", "cart_session_id": "x"}).status_code == 404


def test_enquiry_status_validation(client):
    assert client.patch("/api/pharmacies/enquiry/nope/status", json={"status": "message_sent"}).status_code == 422


def test_tinyfish_unconfigured_endpoint_returns_503(client):
    client.app.state.pharmacy_service.tinyfish = TinyFishService(api_key="")
    response = client.post("/api/pharmacies/nearby", json={"area": "Lucknow", "providers": ["jan_aushadhi"]})
    assert response.status_code == 503
    assert "TINYFISH_API_KEY" in response.json()["detail"]


def test_out_of_radius_store_is_not_returned(client):
    far = sample_store("Far Kendra", "Far Road, Lucknow", 27.5, 80.95)
    fake = FakeTinyFish(sources={"jan_aushadhi": [{"url": "https://listing.test/far"}]}, records={"https://listing.test/far": [far]})
    client.app.state.pharmacy_service.tinyfish = fake
    result = client.post("/api/pharmacies/nearby", json={"latitude": 26.85, "longitude": 80.95, "radius_km": 1, "providers": ["jan_aushadhi"]}).json()
    assert result["stores"] == []


def test_openapi_contains_stage_three_routes(client):
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    assert "/api/cart/add" in paths
    assert "/api/pharmacies/nearby" in paths
    assert "/api/pharmacies/enquiry/create" in paths
    assert "/api/prescriptions/scan" in paths
