from __future__ import annotations

from difflib import SequenceMatcher
from hashlib import sha256
import logging
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlparse

import pandas as pd

from app.services.search_service import normalize

logger = logging.getLogger(__name__)

CDSCO_ALERTS_INDEX = "https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug"
REQUIRED_COLUMNS = {
    "notice_month", "serial_no", "product_name", "batch_number", "manufacturing_date",
    "expiry_date", "manufacturer", "nsq_result", "reported_by", "source_pdf",
    "extraction_text", "review_status",
}
ALERT_COLUMNS = (
    "notice_month", "serial_no", "product_name", "batch_number", "manufacturing_date",
    "expiry_date", "manufacturer", "nsq_result", "reported_by", "source_pdf",
    "extraction_text", "review_status",
)
NSQ_WARNING_TEXT = (
    "CDSCO NSQ ALERT: This medicine batch appears in the supplied Not of Standard Quality alert dataset. "
    "Do not sell or dispense this batch. Verify the official notice and batch details."
)
REVIEW_WARNING_TEXT = "This batch has a possible or unreviewed alert match. Pause sale/dispensing and verify the official notice and exact batch details."
SAFETY_DISCLAIMER = (
    "This check only compares a specific batch with the currently loaded supplied CDSCO extraction. "
    "CLEAR means no matching row was found in that dataset; it is not a safety certification, does not "
    "confirm current regulatory status, and does not replace checking the original official CDSCO notice."
)


def normalize_batch(value: str | None) -> str:
    if not value:
        return ""
    # Batch identifiers are compared exactly after case and punctuation normalization;
    # no fuzzy/OCR correction is applied to batch numbers.
    return "".join(character for character in str(value).upper() if character.isalnum())


def normalize_product(value: str | None) -> str:
    return normalize(value or "")


def normalize_manufacturer(value: str | None) -> str:
    return normalize(value or "")


class CDSCOSafetyService:
    """Pandas-backed supplied alert dataset plus non-destructive reviewer overlays."""

    def __init__(self, csv_path: str | Path | None = None):
        self.csv_path = Path(csv_path) if csv_path else Path(__file__).resolve().parents[1] / "data" / "MedEasy_CDSCO_extraction_updated.csv"
        self._rows: list[dict[str, Any]] = []
        self._overrides: dict[str, dict[str, Any]] = {}
        self.latest_notice_month: str | None = None

    def load_csv(self, path: str | Path | None = None) -> int:
        source = Path(path) if path else self.csv_path
        if not source.is_file():
            logger.error("CDSCO NSQ dataset not found: %s", source)
            raise FileNotFoundError(f"CDSCO NSQ dataset not found: {source}")
        try:
            frame = pd.read_csv(source, dtype=str, keep_default_na=False)
        except Exception:
            logger.exception("Failed to parse CDSCO NSQ dataset %s", source)
            raise

        # Normalize common header variants into the canonical extraction schema.
        aliases = {
            "month": "notice_month", "reporting_month": "notice_month", "reporting_month_year": "notice_month",
            "s_no": "serial_no", "s_no.": "serial_no", "name_of_product": "product_name",
            "product": "product_name", "batch_no": "batch_number", "batch_no.": "batch_number",
            "mfg_date": "manufacturing_date", "mfg._date": "manufacturing_date",
            "exp_date": "expiry_date", "mfg_by": "manufacturer", "manufactured_by": "manufacturer",
            "test_result": "nsq_result", "result": "nsq_result", "reporting_by_lab_state": "reported_by",
            "source": "source_pdf", "source_file": "source_pdf", "extracted_text": "extraction_text",
            "review_status": "review_status",
        }
        normalized_columns: dict[str, str] = {}
        for column in frame.columns:
            key = re.sub(r"[^a-z0-9]+", "_", str(column).strip().casefold()).strip("_")
            normalized_columns[column] = aliases.get(key, key)
        frame = frame.rename(columns=normalized_columns)
        # A dataset with no recognizable batch or product field cannot support batch safety checks.
        if not ({"batch_number", "product_name"} & set(frame.columns)):
            message = f"CDSCO dataset has no recognizable product_name or batch_number column: {source}"
            logger.error(message)
            raise ValueError(message)
        missing = REQUIRED_COLUMNS - set(frame.columns)
        if missing:
            logger.warning("CDSCO dataset %s is missing columns %s; retaining rows with those fields empty", source, sorted(missing))
            for column in missing:
                frame[column] = ""
        frame = frame[list(ALERT_COLUMNS)].fillna("")
        rows: list[dict[str, Any]] = []
        for index, record in enumerate(frame.to_dict(orient="records"), start=1):
            raw = {key: self._nullable(record.get(key)) for key in ALERT_COLUMNS}
            # Row ordinal ensures IDs remain unique even when source identifiers are missing.
            identity = f"{index}|{raw.get('notice_month') or ''}|{raw.get('serial_no') or ''}"
            raw["alert_id"] = "nsq-" + sha256(identity.encode("utf-8")).hexdigest()[:16]
            raw["_batch_normalized"] = normalize_batch(raw.get("batch_number"))
            raw["_product_normalized"] = normalize_product(raw.get("product_name"))
            raw["_manufacturer_normalized"] = normalize_manufacturer(raw.get("manufacturer"))
            rows.append(raw)
        if not rows:
            message = f"CDSCO NSQ dataset loaded zero records: {source}"
            logger.error(message)
            raise ValueError(message)
        months = [row["notice_month"] for row in rows if row.get("notice_month")]
        self._rows = rows
        self._overrides = {}
        self.latest_notice_month = max(months) if months else None
        self.csv_path = source.resolve()
        logger.info("Loaded %d CDSCO NSQ records from %s (%d review-pending)", self.count, source, self.review_pending_count)
        return len(rows)

    @property
    def count(self) -> int:
        return len(self._rows)

    @property
    def review_pending_count(self) -> int:
        return sum(self._verification_status(row) != "officially_verified" for row in self._rows)

    @property
    def verified_count(self) -> int:
        return self.count - self.review_pending_count

    def dataset_status(self) -> dict[str, Any]:
        return {
            "success": True,
            "dataset_file": self.csv_path.name,
            "dataset_path": str(self.csv_path),
            "records_loaded": self.count,
            "review_pending_count": self.review_pending_count,
            "verified_count": self.verified_count,
            "dataset_latest_notice_month": self.latest_notice_month,
            "ready": self.count > 0,
        }

    def list_alerts(self, offset: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        return [self._public_record(row) for row in self._rows[offset:offset + limit]]

    def get_alert(self, alert_id: str) -> dict[str, Any] | None:
        row = next((item for item in self._rows if item["alert_id"] == alert_id), None)
        return self._public_record(row) if row else None

    def check_batch(self, product_name: str | None, batch_number: str | None, manufacturer: str | None = None) -> dict[str, Any]:
        product_key = normalize_product(product_name)
        batch_key = normalize_batch(batch_number)
        manufacturer_key = normalize_manufacturer(manufacturer)
        if not batch_key:
            return self._check_response(
                status="INSUFFICIENT_DATA", product_name=product_name, batch_number=batch_number,
                manufacturer=manufacturer, candidates=[], action="PROVIDE_PRODUCT_AND_BATCH_DETAILS",
                confirmed=False,
            )

        exact_batch_rows = [row for row in self._rows if row["_batch_normalized"] == batch_key]
        product_rows_without_batch = [
            row for row in self._rows
            if not row["_batch_normalized"] and row["_product_normalized"] == product_key
        ]
        exact_matches: list[dict[str, Any]] = []
        review_candidates: list[dict[str, Any]] = []
        for row in exact_batch_rows:
            product_matches = bool(product_key and row["_product_normalized"] == product_key)
            manufacturer_matches = bool(manufacturer_key and row["_manufacturer_normalized"] == manufacturer_key)
            product_conflicts = bool(product_key and row["_product_normalized"] and not product_matches)
            manufacturer_conflicts = bool(manufacturer_key and row["_manufacturer_normalized"] and row["_manufacturer_normalized"] != manufacturer_key)
            identity_matches = (product_matches or manufacturer_matches) and not product_conflicts and not manufacturer_conflicts
            if identity_matches and self._verification_status(row) == "officially_verified":
                exact_matches.append(row)
            else:
                review_candidates.append(row)

        if exact_matches:
            alert = exact_matches[0]
            return self._check_response(
                status="NSQ_FLAGGED", product_name=product_name, batch_number=batch_number,
                manufacturer=manufacturer, candidates=[alert], alert=alert,
                action="DO_NOT_SELL_OR_DISPENSE_THIS_BATCH", confirmed=True,
            )
        if exact_batch_rows:
            return self._check_response(
                status="NEEDS_REVIEW", product_name=product_name, batch_number=batch_number,
                manufacturer=manufacturer, candidates=review_candidates or exact_batch_rows,
                action="PAUSE_AND_MANUALLY_VERIFY_THIS_BATCH", confirmed=False,
            )
        if product_rows_without_batch:
            return self._check_response(
                status="NEEDS_REVIEW", product_name=product_name, batch_number=batch_number,
                manufacturer=manufacturer, candidates=product_rows_without_batch,
                action="VERIFY_SOURCE_RECORD_BECAUSE_ALERT_BATCH_DATA_IS_INCOMPLETE", confirmed=False,
            )
        if not product_key:
            return self._check_response(
                status="INSUFFICIENT_DATA", product_name=product_name, batch_number=batch_number,
                manufacturer=manufacturer, candidates=[], action="PROVIDE_PRODUCT_AND_BATCH_DETAILS",
                confirmed=False,
            )
        return self._check_response(
            status="CLEAR", product_name=product_name, batch_number=batch_number,
            manufacturer=manufacturer, candidates=[], action="NO_MATCH_IN_LOADED_DATASET_NOT_A_SAFETY_CERTIFICATION",
            confirmed=False,
        )

    def check_medicine(self, medicine_name: str) -> dict[str, Any]:
        query = normalize_product(medicine_name)
        if not query:
            raise ValueError("medicine_name must not be empty")
        matches: list[tuple[float, dict[str, Any]]] = []
        for row in self._rows:
            product = row["_product_normalized"]
            if not product:
                continue
            if query == product:
                score = 1.0
            elif query in product or product in query:
                score = 0.85
            else:
                score = SequenceMatcher(None, query, product).ratio()
            if score >= 0.72:
                matches.append((score, row))
        matches.sort(key=lambda pair: (-pair[0], pair[1]["alert_id"]))
        relevant = [self._public_record(row) for _, row in matches]
        return {
            "success": True,
            "safety_status": "NEEDS_REVIEW" if relevant else "CLEAR",
            "result_type": "medicine_level_search",
            "batch_match_confirmed": False,
            "medicine_name": medicine_name,
            "total_relevant_alerts": len(relevant),
            "alerts": relevant,
            "dataset_latest_notice_month": self.latest_notice_month,
            "safety_disclaimer": SAFETY_DISCLAIMER,
            "warning": REVIEW_WARNING_TEXT if relevant else None,
        }

    def review_alert(
        self,
        alert_id: str,
        *,
        official_source_url: str,
        verification_notes: str,
        corrections: dict[str, str | None],
    ) -> dict[str, Any] | None:
        row = next((item for item in self._rows if item["alert_id"] == alert_id), None)
        if row is None:
            return None
        parsed = urlparse(official_source_url)
        host = (parsed.hostname or "").casefold()
        allowed = ("cdsco.gov.in", "cdscoonline.gov.in", "cdsco.mohfw.gov.in")
        if parsed.scheme != "https" or not any(host == domain or host.endswith("." + domain) for domain in allowed):
            raise ValueError("Verification source must be an official CDSCO domain")
        allowed_fields = {"product_name", "batch_number", "manufacturer", "manufacturing_date", "expiry_date", "nsq_result"}
        cleaned = {key: (value.strip() if isinstance(value, str) else None) for key, value in corrections.items() if key in allowed_fields}
        self._overrides[alert_id] = {
            **cleaned,
            "verification_status": "officially_verified",
            "official_source_url": official_source_url,
            "verification_notes": verification_notes.strip(),
            "verified_at": pd.Timestamp.now(tz="UTC").isoformat(),
        }
        # Rebuild the indexed fields from corrected values without changing the source CSV row.
        row.update({
            "_batch_normalized": normalize_batch(cleaned.get("batch_number", row.get("batch_number"))),
            "_product_normalized": normalize_product(cleaned.get("product_name", row.get("product_name"))),
            "_manufacturer_normalized": normalize_manufacturer(cleaned.get("manufacturer", row.get("manufacturer"))),
        })
        return self._public_record(row)

    def _verification_status(self, row: dict[str, Any]) -> str:
        override = self._overrides.get(row["alert_id"], {})
        if override.get("verification_status") == "officially_verified":
            return "officially_verified"
        return "review_pending"

    def _public_record(self, row: dict[str, Any]) -> dict[str, Any]:
        override = self._overrides.get(row["alert_id"], {})
        record = {key: override.get(key, row.get(key)) for key in ALERT_COLUMNS}
        source_pdf = record.get("source_pdf")
        official_source_url = override.get("official_source_url")
        if not official_source_url and isinstance(source_pdf, str) and source_pdf.strip().startswith("https://"):
            source_url = source_pdf.strip()
            host = (urlparse(source_url).hostname or "").casefold()
            if host.endswith("cdsco.gov.in") or host.endswith("cdscoonline.gov.in") or host.endswith("cdsco.mohfw.gov.in"):
                official_source_url = source_url
        return {
            "alert_id": row["alert_id"],
            **record,
            "verification_status": self._verification_status(row),
            "official_source_url": official_source_url or CDSCO_ALERTS_INDEX,
            "verification_notes": override.get("verification_notes"),
            "verified_at": override.get("verified_at"),
        }

    def _check_response(
        self,
        *,
        status: str,
        product_name: str | None,
        batch_number: str | None,
        manufacturer: str | None,
        candidates: list[dict[str, Any]],
        action: str,
        confirmed: bool,
        alert: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        can_sell = False if status in {"NSQ_FLAGGED", "NEEDS_REVIEW"} else True if status == "CLEAR" else None
        return {
            "success": True,
            "safety_status": status,
            "can_be_sold": can_sell,
            "can_be_dispensed": can_sell,
            "product_name": product_name,
            "batch_number": batch_number,
            "manufacturer": manufacturer,
            "alert": self._public_record(alert) if alert else None,
            "possible_alerts": [self._public_record(row) for row in candidates if row is not alert],
            "action_required": action,
            "batch_match_confirmed": confirmed,
            "dataset_latest_notice_month": self.latest_notice_month,
            "safety_disclaimer": SAFETY_DISCLAIMER,
            "warning": NSQ_WARNING_TEXT if status == "NSQ_FLAGGED" else REVIEW_WARNING_TEXT if status == "NEEDS_REVIEW" else None,
        }

    @staticmethod
    def _nullable(value: Any) -> str | None:
        if value is None:
            return None
        result = str(value)
        return result if result.strip() else None
