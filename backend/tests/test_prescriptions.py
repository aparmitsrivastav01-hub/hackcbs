from io import BytesIO
from pathlib import Path

import pymupdf as fitz
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app, medicine_service
from app.models.prescription_schemas import ExtractedMedicine, ExtractionResult
from app.services.prescription.extraction_service import (
    GeminiExtractionProvider,
    MissingProviderConfiguration,
    ExtractionProviderTimeout,
)
from app.services.prescription.medicine_matching_service import match_medicine
from app.services.prescription.prescription_service import PrescriptionService
from app.services.medicine_service import MedicineService

CSV = Path(__file__).parents[1] / "app" / "data" / "MedEasy_catalogue_500_complete.csv"


class FakeProvider:
    def __init__(self, medicines=None, error=None):
        self.medicines = medicines if medicines is not None else []
        self.error = error
        self.received_mime = None

    async def extract(self, data: bytes, mime_type: str) -> ExtractionResult:
        self.received_mime = mime_type
        if self.error:
            raise self.error
        return ExtractionResult(medicines=self.medicines)


@pytest.fixture(scope="module", autouse=True)
def load_catalogue():
    medicine_service.load_csv(CSV)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        test_client.app.state.prescription_service.extraction_provider = FakeProvider([
            ExtractedMedicine(
                prescribed_name="Zerodol-P",
                normalized_name="Zerodol-P",
                active_salt="Aceclofenac + Paracetamol (100 mg + 325 mg)",
                strength=None,
                dosage_form="Tablet",
                dosage_instructions="1-0-1",
                duration="5 days",
                confidence=0.98,
            ),
            ExtractedMedicine(
                prescribed_name="Unreadable line",
                normalized_name="Unreadable line",
                confidence=0.4,
            ),
        ])
        yield test_client


def image_bytes(fmt="JPEG"):
    stream = BytesIO()
    Image.new("RGB", (16, 16), color="white").save(stream, format=fmt)
    return stream.getvalue()


def pdf_bytes():
    document = fitz.open()
    document.new_page(width=100, height=100)
    data = document.tobytes()
    document.close()
    return data


def test_valid_image_upload_and_multiple_medicine_extraction(client):
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 200
    result = response.json()
    assert result["total_medicines_detected"] == 2
    assert result["matched_medicines"] == 1
    assert result["unmatched_medicines"] == 1
    assert result["medicines"][0]["catalogue_match"]["status"] == "matched"
    assert result["medicines"][0]["dosage_instructions"] == "1-0-1"
    assert result["medicines"][1]["prices"] == {"private_brand": None, "jan_aushadhi": None, "dava_india": None}
    assert result["medicines"][1]["duration"] is None
    assert result["total_potential_savings"] == 62.8


def test_valid_pdf_upload(client):
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.pdf", pdf_bytes(), "application/pdf")})
    assert response.status_code == 200
    assert response.json()["total_medicines_detected"] == 2


def test_invalid_file_type(client):
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.txt", b"plain text", "text/plain")})
    assert response.status_code == 415


def test_upload_file_size_limit(client):
    response = client.post("/api/prescriptions/scan", files={"file": ("huge.png", b"x" * (10 * 1024 * 1024 + 1), "image/png")})
    assert response.status_code == 413


def test_corrupt_image_and_pdf_rejected(client):
    assert client.post("/api/prescriptions/scan", files={"file": ("bad.png", b"\x89PNG\r\n\x1a\ntruncated", "image/png")}).status_code == 400
    assert client.post("/api/prescriptions/scan", files={"file": ("bad.pdf", b"%PDF-not really a pdf", "application/pdf")}).status_code == 400


def test_missing_fields_are_returned_as_null(client):
    data = image_bytes()
    fake = FakeProvider([ExtractedMedicine(prescribed_name="Unclear", confidence=0.2)])
    client.app.state.prescription_service.extraction_provider = fake
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", data, "image/jpeg")})
    medicine = response.json()["medicines"][0]
    assert medicine["strength"] is None
    assert medicine["dosage_form"] is None
    assert medicine["dosage_instructions"] is None
    assert medicine["duration"] is None
    assert medicine["catalogue_match"]["status"] in {"not_found", "needs_review"}


def test_exact_catalogue_matching():
    row = medicine_service.get(1)
    extracted = ExtractedMedicine(
        prescribed_name="Zerodol-P",
        active_salt=row["active_salt"],
        dosage_form="Tablet",
        confidence=0.98,
    )
    match = match_medicine(extracted, [row])
    assert match.status == "matched"
    assert match.medicine_id == 1


def test_strength_mismatch_never_matches():
    row = medicine_service.get(1)
    extracted = ExtractedMedicine(prescribed_name="Zerodol-P", active_salt=row["active_salt"], strength="650 mg", confidence=0.99)
    match = match_medicine(extracted, [row])
    assert match.status == "not_found"
    assert match.medicine_id is None


def test_combination_medicine_does_not_match_single_ingredient():
    row = medicine_service.get(1)
    extracted = ExtractedMedicine(
        prescribed_name="Zerodol-P",
        active_salt="Paracetamol 325 mg",
        strength="325 mg",
        dosage_form="Tablet",
        confidence=0.99,
    )
    match = match_medicine(extracted, [row])
    assert match.status == "not_found"


def test_unmatched_medicine_has_null_comparison(client):
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    medicine = response.json()["medicines"][1]
    assert medicine["catalogue_match"]["status"] == "needs_review"
    assert medicine["prices"]["private_brand"] is None
    assert medicine["savings_comparison"]["maximum_savings"]["amount"] is None


def test_prescription_price_comparison_and_summary(client):
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    result = response.json()
    item = result["medicines"][0]
    assert item["prices"]["private_brand"] == 68.5
    assert item["savings_comparison"]["maximum_savings"]["amount"] == 62.8
    assert result["total_potential_savings"] == 62.8


def test_missing_price_values_stay_null():
    local_catalogue = MedicineService()
    row = {"id": 9001, "brand_name": "Unknown Brand", "active_salt": "Testdrug 100 mg", "dosage_form": "Tablet", "private_brand_price": None, "jan_aushadhi_price": None, "dava_india_price": None, "category": "Test"}
    local_catalogue._rows = [row]
    local_catalogue._by_id = {9001: row}
    service = PrescriptionService(local_catalogue, FakeProvider())
    result = service._build_medicine(ExtractedMedicine(prescribed_name="Unknown Brand", active_salt="Testdrug 100 mg", confidence=0.99))
    assert result["prices"] == {"private_brand": None, "jan_aushadhi": None, "dava_india": None}


def test_provider_failure_returns_gateway_error(client):
    class BrokenProvider:
        async def extract(self, data, mime_type):
            raise RuntimeError("sensitive internal failure")

    client.app.state.prescription_service.extraction_provider = BrokenProvider()
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 502
    assert "sensitive internal failure" not in response.text


def test_missing_gemini_key_is_clear(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    provider = GeminiExtractionProvider(api_key="", timeout_seconds=0.1)
    with pytest.raises(MissingProviderConfiguration):
        import asyncio
        asyncio.run(provider.extract(image_bytes(), "image/jpeg"))


def test_prescription_retrieval_endpoints(client):
    scan = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")}).json()
    prescription_id = scan["prescription_id"]
    assert client.get(f"/api/prescriptions/{prescription_id}").status_code == 200
    medicines = client.get(f"/api/prescriptions/{prescription_id}/medicines").json()
    assert medicines["total_medicines_detected"] == 2
    summary = client.get(f"/api/prescriptions/{prescription_id}/summary").json()
    assert summary["matched_medicines"] == 1
    assert summary["savings_label"] == "potential savings, not guaranteed savings"


def test_unknown_prescription_id_returns_404(client):
    assert client.get("/api/prescriptions/unknown/summary").status_code == 404


def test_empty_extraction_returns_422(client):
    client.app.state.prescription_service.extraction_provider = FakeProvider([])
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 422
    assert "No medicines" in response.json()["detail"]


def test_missing_gemini_key_returns_503(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    client.app.state.prescription_service.extraction_provider = GeminiExtractionProvider(api_key="")
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.json()["detail"]


def test_exact_duplicate_lines_are_removed_but_distinct_directions_remain():
    service = PrescriptionService(medicine_service, FakeProvider())
    repeated = ExtractedMedicine(prescribed_name="Dolo 650", strength="650 mg", dosage_instructions="1-0-1", duration="5 days")
    different = repeated.model_copy(update={"dosage_instructions": "1-1-1"})
    assert len(service._deduplicate([repeated, repeated, different])) == 2


def test_provider_timeout_returns_gateway_timeout(client):
    class TimeoutProvider:
        async def extract(self, data, mime_type):
            raise ExtractionProviderTimeout("Prescription extraction provider timed out")

    client.app.state.prescription_service.extraction_provider = TimeoutProvider()
    response = client.post("/api/prescriptions/scan", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 504
    assert "timed out" in response.json()["detail"]


def test_extract_draft_endpoint_success(client):
    fake = FakeProvider([
        ExtractedMedicine(
            raw_text="T. Etolasse-P 1-0-1",
            prescribed_name="Etolasse-P",
            strength="400mg + 325mg",
            dosage_form="Tablet",
            dosage_instructions="1-0-1",
            confidence=0.92,
            needs_review=False,
        ),
        ExtractedMedicine(
            raw_text="Unclear handwriting line",
            prescribed_name="Unclear",
            confidence=0.45,
            uncertain_parts=["Handwriting illegible"],
            needs_review=True,
        ),
    ])
    client.app.state.prescription_service.extraction_provider = fake
    response = client.post("/api/prescriptions/extract", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["search_performed"] is False
    assert len(data["extraction"]["items"]) == 2
    item1 = data["extraction"]["items"][0]
    assert item1["medicine_name"] == "Etolasse-P"
    assert item1["confidence"] == "High"
    assert item1["needs_review"] is False
    item2 = data["extraction"]["items"][1]
    assert item2["confidence"] == "Low"
    assert item2["needs_review"] is True
    assert len(item2["uncertain_parts"]) == 1


def test_extract_draft_pdf_with_embedded_text(client):
    fake = FakeProvider([
        ExtractedMedicine(
            raw_text="Paracetamol 500mg",
            prescribed_name="Paracetamol",
            strength="500mg",
            dosage_form="Tablet",
            confidence=0.95,
        ),
    ])
    client.app.state.prescription_service.extraction_provider = fake
    response = client.post("/api/prescriptions/extract", files={"file": ("rx.pdf", pdf_bytes(), "application/pdf")})
    assert response.status_code == 200
    assert len(response.json()["extraction"]["items"]) == 1


def test_extract_draft_empty_result(client):
    client.app.state.prescription_service.extraction_provider = FakeProvider([])
    response = client.post("/api/prescriptions/extract", files={"file": ("rx.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 200
    data = response.json()
    assert len(data["extraction"]["items"]) == 0


def test_search_confirmed_endpoint(client):
    payload = {
        "items": [
            {
                "medicine_name": "Zerodol-P",
                "strength": "100 mg + 325 mg",
                "dosage_form": "Tablet",
            }
        ]
    }
    response = client.post("/api/prescriptions/search-confirmed", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["results"]) == 1
    assert data["results"][0]["confirmed_input"]["medicine_name"] == "Zerodol-P"
    assert data["results"][0]["match_count"] >= 1
