from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app, medicine_service
from app.services.medicine_service import MedicineService
from app.services.price_service import compare_prices

CSV = Path(__file__).parents[1] / "app" / "data" / "MedEasy_catalogue_500_complete.csv"


@pytest.fixture(scope="module", autouse=True)
def load_catalogue():
    medicine_service.load_csv(CSV)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_csv_loading():
    service = MedicineService()
    expected = len(pd.read_csv(CSV))
    assert service.load_csv(CSV) == expected
    assert expected >= 500


def test_exact_medicine_search(client):
    response = client.get("/api/medicines/search", params={"q": "Paracetamol 500 mg"})
    assert response.status_code == 200
    assert response.json()["total_results"] >= 1
    assert response.json()["results"][0]["active_salt"]


def test_brand_search(client):
    result = client.get("/api/medicines/search?q=Zerodol-P").json()
    assert result["results"][0]["brand_name"] == "Zerodol-P"


def test_generic_composition_search(client):
    result = client.get("/api/medicines/search", params={"q": "Aceclofenac 100 mg"}).json()
    assert any("Aceclofenac 100 mg" in item["active_salt"] for item in result["results"])


def test_strength_matching(client):
    result = client.get("/api/medicines/search", params={"q": "Paracetamol 500 mg"}).json()
    assert all("650 mg" not in item["active_salt"] for item in result["results"])


def test_case_insensitive_search(client):
    assert client.get("/api/medicines/search?q=zerodol-p").json()["total_results"] >= 1


def test_empty_query(client):
    assert client.get("/api/medicines/search?q=%20%20").status_code == 422


def test_no_matching_medicines(client):
    result = client.get("/api/medicines/search?q=zzqv-no-such-medicine").json()
    assert result["total_results"] == 0
    assert result["results"] == []


def test_invalid_medicine_id(client):
    assert client.get("/api/medicines/99999999").status_code == 404


def test_price_calculation():
    result = compare_prices({"private_brand_price": 18.5, "jan_aushadhi_price": 1.2, "dava_india_price": 2.5})
    assert result["cheapest_provider"] == "Jan Aushadhi"
    assert result["cheapest_price"] == 1.2
    assert result["savings"] == 17.3
    assert result["savings_percentage"] == 93.51


def test_missing_prices_are_not_zero():
    result = compare_prices({"private_brand_price": None, "jan_aushadhi_price": "invalid", "dava_india_price": None})
    assert result["cheapest_provider"] is None
    assert result["cheapest_price"] is None
    assert result["prices"]["private_brand"] is None


def test_health_and_categories(client):
    health = client.get("/api/health").json()
    assert health["status"] == "ok"
    assert health["catalogue_records"] == len(pd.read_csv(CSV))
    assert health["catalogue_records"] >= 500
    categories = client.get("/api/medicines/categories").json()
    assert categories["total_categories"] == len(categories["categories"])


def test_get_medicine(client):
    response = client.get("/api/medicines/1")
    assert response.status_code == 200
    assert response.json()["brand_name"] == "Zerodol-P"


def test_jan_aushadhi_maximum_savings():
    from app.services.price_service import savings_comparison

    result = savings_comparison({"private_brand_price": 18.5, "jan_aushadhi_price": 1.2, "dava_india_price": 2.5})
    assert result["jan_aushadhi"] == {"savings_amount": 17.3, "savings_percentage": 93.51}
    assert result["maximum_savings"]["provider"] == "Jan Aushadhi"
    assert result["maximum_savings"]["alternative_price"] == 1.2


def test_dava_india_maximum_savings():
    from app.services.price_service import savings_comparison

    result = savings_comparison({"private_brand_price": 20, "jan_aushadhi_price": 15, "dava_india_price": 2})
    assert result["maximum_savings"]["provider"] == "Dava India"
    assert result["maximum_savings"]["amount"] == 18
    assert result["dava_india"]["savings_percentage"] == 90


def test_equal_savings_returns_both_providers():
    from app.services.price_service import savings_comparison

    result = savings_comparison({"private_brand_price": 20, "jan_aushadhi_price": 5, "dava_india_price": 5})
    assert result["maximum_savings"]["provider"] == ["Jan Aushadhi", "Dava India"]
    assert result["maximum_savings"]["amount"] == 15


def test_maximum_savings_missing_prices():
    from app.services.price_service import savings_comparison

    result = savings_comparison({"private_brand_price": 20, "jan_aushadhi_price": None, "dava_india_price": "bad"})
    assert result["jan_aushadhi"]["savings_amount"] is None
    assert result["dava_india"]["savings_percentage"] is None
    assert result["maximum_savings"] is None


def test_maximum_savings_zero_private_price_has_no_percentage():
    from app.services.price_service import savings_comparison

    result = savings_comparison({"private_brand_price": 0, "jan_aushadhi_price": 0, "dava_india_price": None})
    assert result["jan_aushadhi"]["savings_amount"] == 0
    assert result["jan_aushadhi"]["savings_percentage"] is None
    assert result["maximum_savings"]["percentage"] is None


def test_more_expensive_alternatives_are_not_savings_opportunities():
    from app.services.price_service import maximum_savings_opportunities, savings_comparison

    row = {"id": 1, "brand_name": "Sample", "private_brand_price": 10, "jan_aushadhi_price": 12, "dava_india_price": 11}
    result = savings_comparison(row)
    assert result["jan_aushadhi"]["savings_amount"] == -2
    assert result["dava_india"]["savings_percentage"] == -10
    assert result["maximum_savings"] is None
    assert maximum_savings_opportunities([row])["top_savings"] == []


def test_top_ten_savings_sorted_by_amount():
    from app.services.price_service import maximum_savings_opportunities

    rows = [
        {"id": i, "brand_name": f"Medicine {i}", "private_brand_price": 100 + i, "jan_aushadhi_price": 100}
        for i in range(1, 15)
    ]
    result = maximum_savings_opportunities(rows)
    assert len(result["top_savings"]) == 10
    amounts = [item["savings_amount"] for item in result["top_savings"]]
    assert amounts == sorted(amounts, reverse=True)
    assert result["highest_savings_amount"] == result["top_savings"][0]


def test_maximum_savings_provider_filter(client):
    from app.services.price_service import maximum_savings_opportunities

    all_results = maximum_savings_opportunities(medicine_service.all())
    for provider, display_name in (("jan_aushadhi", "Jan Aushadhi"), ("dava_india", "Dava India")):
        response = client.get("/api/medicines/maximum-savings", params={"provider": provider})
        assert response.status_code == 200
        payload = response.json()
        assert payload["provider"] == provider
        assert all(item["alternative_provider"] == display_name for item in payload["top_savings"])
        provider_rows = maximum_savings_opportunities(medicine_service.all(), provider=provider)["top_savings"]
        assert payload["top_savings"] == provider_rows
        assert len(payload["top_savings"]) <= 10
    assert len(all_results["top_savings"]) <= 10


def test_maximum_savings_endpoint_rejects_unknown_provider(client):
    assert client.get("/api/medicines/maximum-savings?provider=other").status_code == 422
