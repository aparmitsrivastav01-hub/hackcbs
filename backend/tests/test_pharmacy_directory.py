import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_get_pharmacy_directory_seed(client):
    response = client.get("/api/stores/directory")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total"] > 0
    assert len(data["stores"]) == data["total"]
    assert len(data["districts"]) > 0

    first_store = data["stores"][0]
    assert "store_id" in first_store
    assert "brand" in first_store
    assert first_store["brand"] in ["Jan Aushadhi", "Davaindia"]
    assert "store_name" in first_store
    assert "address" in first_store
    assert "district" in first_store
    assert "pincode" in first_store
    assert "data_status" in first_store


def test_filter_directory_by_brand(client):
    response_ja = client.get("/api/stores/directory?brand=Jan%20Aushadhi")
    assert response_ja.status_code == 200
    data_ja = response_ja.json()
    assert data_ja["success"] is True
    assert len(data_ja["stores"]) > 0
    for store in data_ja["stores"]:
        assert store["brand"] == "Jan Aushadhi"

    response_di = client.get("/api/stores/directory?brand=Davaindia")
    assert response_di.status_code == 200
    data_di = response_di.json()
    assert data_di["success"] is True
    assert len(data_di["stores"]) > 0
    for store in data_di["stores"]:
        assert store["brand"] == "Davaindia"


def test_filter_directory_by_district(client):
    response = client.get("/api/stores/directory?district=North%20West%20Delhi")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["stores"]) > 0
    for store in data["stores"]:
        assert store["district"] == "North West Delhi"


def test_search_directory(client):
    response = client.get("/api/stores/directory?search=Rohini")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total"] >= 1
    for store in data["stores"]:
        text = f"{store['store_name']} {store['address']} {store['district']} {store['pincode']}".lower()
        assert "rohini" in text


def test_sort_by_distance(client):
    response = client.get("/api/stores/directory?sort_by_distance=true")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    # Stores with valid numeric distance should appear first, followed by None
    distances = [s["distance_from_shaheed_sukhdev_km"] for s in data["stores"]]
    valid_distances = [d for d in distances if d is not None]
    assert valid_distances == sorted(valid_distances)
