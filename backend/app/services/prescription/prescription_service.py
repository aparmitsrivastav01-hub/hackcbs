from collections.abc import Iterable
from typing import Any
from uuid import uuid4

from app.models.prescription_schemas import ExtractedMedicine, ExtractionResult
from app.services.medicine_service import MedicineService
from app.services.price_service import compare_prices
from app.services.prescription.document_service import ValidatedDocument
from app.services.prescription.extraction_service import (
    ExtractionProvider,
    ExtractionProviderError,
    ExtractionProviderTimeout,
    GeminiExtractionProvider,
)
from app.services.prescription.medicine_matching_service import match_medicine
from app.services.search_service import normalize


class PrescriptionService:
    def __init__(self, medicine_service: MedicineService, extraction_provider: ExtractionProvider | None = None):
        self.medicine_service = medicine_service
        self.extraction_provider = extraction_provider
        self._prescriptions: dict[str, dict[str, Any]] = {}

    async def scan(self, document: ValidatedDocument) -> dict[str, Any]:
        provider = self.extraction_provider or GeminiExtractionProvider()
        try:
            extraction = await provider.extract(document.data, document.mime_type)
        except ExtractionProviderError:
            raise
        except TimeoutError as exc:
            raise ExtractionProviderTimeout("Prescription extraction provider timed out") from exc
        except Exception as exc:
            raise ExtractionProviderError("Prescription extraction provider failed") from exc
        extracted = self._deduplicate(extraction.medicines)
        if not extracted:
            raise ValueError("No medicines were detected in the uploaded prescription")

        medicine_results = [self._build_medicine(item) for item in extracted]
        matched = sum(item["catalogue_match"]["status"] == "matched" for item in medicine_results)
        unmatched = len(medicine_results) - matched
        total_savings = round(sum(
            item["savings_comparison"]["maximum_savings"]["amount"]
            for item in medicine_results
            if item["catalogue_match"]["status"] == "matched"
            and item["savings_comparison"]["maximum_savings"]["amount"] is not None
            and item["savings_comparison"]["maximum_savings"]["amount"] > 0
        ), 2)
        prescription_id = str(uuid4())
        summary = {
            "total_medicines_detected": len(medicine_results),
            "matched_medicines": matched,
            "unmatched_medicines": unmatched,
            "jan_aushadhi_prices_available": sum(item["prices"]["jan_aushadhi"] is not None for item in medicine_results),
            "dava_india_prices_available": sum(item["prices"]["dava_india"] is not None for item in medicine_results),
            "total_potential_savings": total_savings,
            "savings_label": "potential savings, not guaranteed savings",
        }
        response = {
            "success": True,
            "prescription_id": prescription_id,
            "total_medicines_detected": len(medicine_results),
            "matched_medicines": matched,
            "unmatched_medicines": unmatched,
            "total_potential_savings": total_savings,
            "medicines": medicine_results,
            "summary": summary,
        }
        self._prescriptions[prescription_id] = response
        return response

    def get(self, prescription_id: str) -> dict[str, Any] | None:
        return self._prescriptions.get(prescription_id)

    def get_medicines(self, prescription_id: str) -> dict[str, Any] | None:
        record = self.get(prescription_id)
        if record is None:
            return None
        return {
            "success": True,
            "prescription_id": prescription_id,
            "total_medicines_detected": record["total_medicines_detected"],
            "medicines": record["medicines"],
        }

    def get_summary(self, prescription_id: str) -> dict[str, Any] | None:
        record = self.get(prescription_id)
        if record is None:
            return None
        return record["summary"]

    def _build_medicine(self, extracted: ExtractedMedicine) -> dict[str, Any]:
        normalized_name = extracted.normalized_name
        if normalized_name is None and extracted.prescribed_name is not None:
            normalized_name = " ".join(extracted.prescribed_name.split()) or None
        normalized_extracted = extracted.model_copy(update={"normalized_name": normalized_name})
        match = match_medicine(normalized_extracted, self.medicine_service.all())
        matched_row = self.medicine_service.get(match.medicine_id) if match.status == "matched" and match.medicine_id is not None else None

        if matched_row is None:
            prices = {"private_brand": None, "jan_aushadhi": None, "dava_india": None}
            savings = {
                "jan_aushadhi": {"amount": None, "percentage": None},
                "dava_india": {"amount": None, "percentage": None},
                "maximum_savings": {"provider": None, "amount": None, "percentage": None},
            }
            cheapest_provider = None
        else:
            comparison = compare_prices(matched_row)
            prices = comparison["prices"]
            savings_source = comparison["savings_comparison"]
            maximum = savings_source["maximum_savings"]
            savings = {
                "jan_aushadhi": {
                    "amount": savings_source["jan_aushadhi"]["savings_amount"],
                    "percentage": savings_source["jan_aushadhi"]["savings_percentage"],
                },
                "dava_india": {
                    "amount": savings_source["dava_india"]["savings_amount"],
                    "percentage": savings_source["dava_india"]["savings_percentage"],
                },
                "maximum_savings": {
                    "provider": maximum["provider"] if maximum else None,
                    "amount": maximum["amount"] if maximum else None,
                    "percentage": maximum["percentage"] if maximum else None,
                },
            }
            cheapest_provider = comparison["cheapest_provider"]

        return {
            "prescribed_name": extracted.prescribed_name,
            "normalized_name": normalized_name,
            "active_salt": extracted.active_salt,
            "strength": extracted.strength,
            "dosage_form": extracted.dosage_form,
            "dosage_instructions": extracted.dosage_instructions,
            "duration": extracted.duration,
            "extraction_confidence": extracted.confidence,
            "catalogue_match": match.model_dump(),
            "prices": prices,
            "cheapest_provider": cheapest_provider,
            "savings_comparison": savings,
        }

    @staticmethod
    def _deduplicate(medicines: Iterable[ExtractedMedicine]) -> list[ExtractedMedicine]:
        unique: list[ExtractedMedicine] = []
        seen: set[tuple[str, ...]] = set()
        for medicine in medicines:
            key = (
                normalize(medicine.prescribed_name or ""),
                normalize(medicine.active_salt or ""),
                normalize(medicine.strength or ""),
                normalize(medicine.dosage_form or ""),
                normalize(medicine.dosage_instructions or ""),
                normalize(medicine.duration or ""),
            )
            if key in seen and any(key):
                continue
            seen.add(key)
            unique.append(medicine)
        return unique
