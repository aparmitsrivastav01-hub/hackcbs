from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.cart_service import CartSafetyBlocked, CartService
from app.services.cdsco_safety_service import CDSCOSafetyService, NSQ_WARNING_TEXT


DATASET = Path(__file__).resolve().parents[1] / "app" / "data" / "MedEasy_CDSCO_extraction_updated.csv"


def loaded_service():
    service = CDSCOSafetyService(DATASET)
    assert service.load_csv() == 260
    return service


def test_csv_load_preserves_records_and_marks_them_unverified():
    service = loaded_service()
    alerts = service.list_alerts(0, 500)
    assert len(alerts) == 260
    assert service.latest_notice_month == "2025-06"
    assert all(alert["verification_status"] == "review_pending" for alert in alerts)
    assert alerts[0]["notice_month"]


def test_loader_maps_header_variants_and_fails_on_empty_dataset(tmp_path):
    aliases = tmp_path / "aliases.csv"
    pd.DataFrame([{"Name of Product": "Test Medicine", "Batch No.": "B-123"}]).to_csv(aliases, index=False)
    service = CDSCOSafetyService(aliases)
    assert service.load_csv() == 1
    assert service.list_alerts(0, 1)[0]["product_name"] == "Test Medicine"
    assert service.list_alerts(0, 1)[0]["batch_number"] == "B-123"

    empty = tmp_path / "empty.csv"
    pd.DataFrame(columns=["product_name", "batch_number"]).to_csv(empty, index=False)
    with pytest.raises(ValueError, match="zero records"):
        CDSCOSafetyService(empty).load_csv()


def test_exact_batch_match_requires_official_human_review_then_flags():
    service = loaded_service()
    alert = next(item for item in service.list_alerts(0, 500) if item["product_name"] and item["batch_number"] and item["manufacturer"])
    result = service.check_batch(alert["product_name"], alert["batch_number"], alert["manufacturer"])
    assert result["safety_status"] == "NEEDS_REVIEW"
    assert result["can_be_sold"] is False

    service.review_alert(
        alert["alert_id"],
        official_source_url="https://cdsco.gov.in/opencms/opencms/en/consumer/NSQ-Alerts/",
        verification_notes="Verified against the linked official CDSCO notice.",
        corrections={},
    )
    checked = service.check_batch(alert["product_name"], alert["batch_number"], alert["manufacturer"])
    assert checked["safety_status"] == "NSQ_FLAGGED"
    assert checked["can_be_sold"] is False
    assert checked["can_be_dispensed"] is False
    assert checked["warning"] == NSQ_WARNING_TEXT


def test_missing_and_nonmatching_batch_results_are_conservative():
    service = loaded_service()
    alert = next(item for item in service.list_alerts(0, 500) if item["product_name"] and item["batch_number"])
    assert service.check_batch(alert["product_name"], None)["safety_status"] == "INSUFFICIENT_DATA"
    assert service.check_batch("Unrelated Example Product", "NEVER-IN-DATASET") ["safety_status"] == "CLEAR"
    assert "not a safety certification" in service.check_batch("Unrelated Example Product", "NEVER-IN-DATASET")["safety_disclaimer"]
    incomplete = next(item for item in service.list_alerts(0, 500) if not item["product_name"] and item["batch_number"])
    incomplete_result = service.check_batch(None, incomplete["batch_number"])
    assert incomplete_result["safety_status"] == "NEEDS_REVIEW"
    assert incomplete_result["possible_alerts"]


def test_possible_match_never_confirms_batch_and_medicine_search_is_review_only():
    service = loaded_service()
    alert = next(item for item in service.list_alerts(0, 500) if item["product_name"] and item["batch_number"])
    conflict = service.check_batch("Different product", alert["batch_number"], alert["manufacturer"])
    assert conflict["safety_status"] == "NEEDS_REVIEW"
    assert conflict["batch_match_confirmed"] is False
    result = service.check_medicine(alert["product_name"])
    assert result["safety_status"] == "NEEDS_REVIEW"
    assert result["batch_match_confirmed"] is False


def test_same_medicine_different_batch_is_not_flagged_and_wrong_manufacturer_needs_review():
    service = loaded_service()
    alert = next(item for item in service.list_alerts(0, 500) if item["product_name"] and item["batch_number"] and item["manufacturer"])
    service.review_alert(
        alert["alert_id"],
        official_source_url="https://cdsco.gov.in/opencms/opencms/en/consumer/NSQ-Alerts/",
        verification_notes="Verified against the linked official CDSCO notice.",
        corrections={},
    )
    alternative = service.check_batch(alert["product_name"], "SAFE-ALTERNATIVE-987", alert["manufacturer"])
    assert alternative["safety_status"] == "CLEAR"
    mismatch = service.check_batch(alert["product_name"], alert["batch_number"], "Different Manufacturer Ltd")
    assert mismatch["safety_status"] == "NEEDS_REVIEW"
    assert mismatch["can_be_sold"] is False


def test_cart_blocks_a_confirmed_flagged_batch():
    service = loaded_service()
    alert = next(item for item in service.list_alerts(0, 500) if item["product_name"] and item["batch_number"] and item["manufacturer"])
    service.review_alert(
        alert["alert_id"],
        official_source_url="https://cdsco.gov.in/opencms/opencms/en/consumer/NSQ-Alerts/",
        verification_notes="Verified against the linked official CDSCO notice.",
        corrections={},
    )

    class Catalogue:
        def get(self, medicine_id):
            return {
                "brand_name": alert["product_name"], "active_salt": alert["product_name"], "dosage_form": "Injection",
                "private_brand_price": 20, "jan_aushadhi_price": 4, "dava_india_price": 5,
            }

    cart = CartService(Catalogue(), service)
    try:
        cart.add(42, 1, "jan_aushadhi", batch_number=alert["batch_number"], manufacturer=alert["manufacturer"])
    except CartSafetyBlocked as exc:
        assert exc.safety_result["safety_status"] == "NSQ_FLAGGED"
        assert "Do not sell or dispense" in exc.safety_result["warning"]
    else:
        raise AssertionError("confirmed flagged batch must not be added to cart")


def test_safety_api_lists_checks_and_returns_404_for_unknown_alert():
    with TestClient(app) as client:
        status = client.get("/api/batch-safety/dataset-status")
        assert status.status_code == 200
        assert status.json()["dataset_file"] == "MedEasy_CDSCO_extraction_updated.csv"
        assert status.json()["records_loaded"] == 260
        assert status.json()["review_pending_count"] == 260
        assert status.json()["verified_count"] == 0

        batch_alerts = client.get("/api/batch-safety/alerts?limit=1")
        assert batch_alerts.status_code == 200
        assert batch_alerts.json()["total_alerts"] == 260

        listed = client.get("/api/safety/alerts?limit=2")
        assert listed.status_code == 200
        assert listed.json()["total_alerts"] == 260
        item = listed.json()["alerts"][0]
        detail = client.get(f"/api/safety/alerts/{item['alert_id']}")
        assert detail.status_code == 200
        batch = client.get("/api/safety/check-batch", params={
            "product_name": item["product_name"] or "Unknown item",
            "batch_number": item["batch_number"] or "UNKNOWN",
        })
        assert batch.status_code == 200
        medicine = client.get("/api/safety/check-medicine", params={"medicine_name": "Dextrose"})
        assert medicine.status_code == 200
        assert medicine.json()["batch_match_confirmed"] is False
        missing = client.get("/api/safety/alerts/not-a-real-alert")
        assert missing.status_code == 404

        actual_record = next(
            alert for alert in client.get("/api/safety/alerts?limit=500").json()["alerts"]
            if alert["product_name"] and alert["batch_number"]
        )
        actual_check = client.get("/api/batch-safety/check-batch", params={
            "product_name": actual_record["product_name"],
            "batch_number": actual_record["batch_number"],
        })
        assert actual_check.status_code == 200
        assert actual_check.json()["safety_status"] == "NEEDS_REVIEW"

