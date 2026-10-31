from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services.cdsco_safety_service import CDSCOSafetyService
from app.services.batch_extraction_service import BatchExtractionService


class MockExtractor:
    async def extract(self, documents):
        from app.models.batch_extraction_schemas import BatchMedicineExtraction
        return BatchMedicineExtraction(medicine_name="Test medicine", batch_number="AB-12", manufacturer="Maker", raw_ocr_text="AB-12", extraction_status="complete")


def make_image() -> bytes:
    output = BytesIO()
    Image.new("RGB", (60, 40), "white").save(output, format="PNG")
    return output.getvalue()


@pytest.fixture()
def client():
    safety = CDSCOSafetyService(Path(__file__).parents[1] / "app/data/MedEasy_CDSCO_extraction_updated.csv")
    safety.load_csv()
    app.state.safety_service = safety
    app.state.batch_extraction_service = MockExtractor()
    with TestClient(app) as test_client:
        # Lifespan loads app services; replace state after startup to isolate this module.
        app.state.safety_service = safety
        app.state.batch_extraction_service = MockExtractor()
        yield test_client


def test_extract_accepts_one_or_multiple_packaging_images(client):
    image = make_image()
    response = client.post("/api/batch-safety/extract", files=[
        ("files", ("front.png", image, "image/png")),
        ("files", ("back.png", image, "image/png")),
    ])
    assert response.status_code == 200
    assert response.json()["batch_number"] == "AB-12"


def test_extract_rejects_invalid_format_and_oversize(client):
    invalid = client.post("/api/batch-safety/extract", files=[("files", ("x.txt", b"x", "text/plain"))])
    assert invalid.status_code == 415
    large = client.post("/api/batch-safety/extract", files=[("files", ("x.png", b"x" * (10 * 1024 * 1024 + 1), "image/png"))])
    assert large.status_code == 413


def test_exact_match_returns_source_records(client):
    safety = app.state.safety_service
    known = next(row for row in safety._rows if row.get("batch_number") and row.get("product_name"))
    response = client.post("/api/batch-safety/verify", json={"medicine_name": known["product_name"], "batch_number": known["batch_number"], "manufacturer": known["manufacturer"]})
    assert response.status_code == 200
    assert response.json()["status"] == "MATCH_FOUND"
    assert response.json()["records"][0]["source_pdf"] == known["source_pdf"]


def test_same_product_different_batch_is_no_match(client):
    safety = app.state.safety_service
    known = next(row for row in safety._rows if row.get("batch_number") and row.get("product_name"))
    response = client.post("/api/batch-safety/verify", json={"medicine_name": known["product_name"], "batch_number": known["batch_number"] + "-DIFFERENT"})
    assert response.json()["status"] == "NO_MATCH"


def test_missing_batch_never_runs_exact_match(client):
    response = client.post("/api/batch-safety/verify", json={"medicine_name": "Some product"})
    assert response.json()["status"] == "INSUFFICIENT_DATA"


def test_dataset_info_reports_loaded_dataset(client):
    response = client.get("/api/batch-safety/dataset-info")
    assert response.status_code == 200
    assert response.json()["records_loaded"] == app.state.safety_service.count
    assert response.json()["source"] == "CDSCO Monthly NSQ Dataset"
