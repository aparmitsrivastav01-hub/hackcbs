from collections.abc import Iterable
from typing import Any
from uuid import uuid4

from app.models.prescription_schemas import (
    ConfirmedMedicineItem,
    DraftExtractionResponse,
    ExtractedItemSchema,
    ExtractedMedicine,
    ExtractionDataSchema,
    ExtractionResult,
)
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

    async def extract_draft(self, document: ValidatedDocument) -> DraftExtractionResponse:
        """Extract draft prescription data without automatic catalogue search.
        Enforces human review gate before medicines are queried against the catalogue.
        """
        provider = self.extraction_provider or GeminiExtractionProvider()
        try:
            extraction = await provider.extract(document.data, document.mime_type)
        except ExtractionProviderError:
            raise
        except TimeoutError as exc:
            raise ExtractionProviderTimeout("Prescription extraction provider timed out") from exc
        except Exception as exc:
            raise ExtractionProviderError("Prescription extraction provider failed") from exc

        deduped = self._deduplicate(extraction.medicines)

        items: list[ExtractedItemSchema] = []
        for m in deduped:
            name = m.prescribed_name or m.normalized_name or ""
            conf_val = m.confidence if m.confidence is not None else 0.5
            if conf_val >= 0.85:
                conf_str = "High"
            elif conf_val >= 0.60:
                conf_str = "Medium"
            else:
                conf_str = "Low"

            items.append(
                ExtractedItemSchema(
                    raw_text=m.raw_text or name or "Prescription line",
                    medicine_name=name or None,
                    strength=m.strength,
                    dosage_form=m.dosage_form,
                    instructions=m.dosage_instructions,
                    confidence=conf_str,
                    uncertain_parts=m.uncertain_parts,
                    needs_user_confirmation=True,
                    needs_review=m.needs_review or (conf_val < 0.70),
                )
            )

        warnings = list(extraction.warnings)
        if not warnings:
            warnings.append(
                "Please verify medicine names and dosages with your doctor or licensed pharmacist."
            )

        other_text = list(extraction.other_text)
        if extraction.patient_details.name:
            details_str = f"Patient: {extraction.patient_details.name}"
            if extraction.patient_details.age:
                details_str += f", Age: {extraction.patient_details.age}"
            if extraction.patient_details.gender:
                details_str += f" / {extraction.patient_details.gender}"
            other_text.insert(0, details_str)

        if extraction.doctor_details.name:
            doc_str = f"Doctor: {extraction.doctor_details.name}"
            if extraction.doctor_details.qualification:
                doc_str += f" ({extraction.doctor_details.qualification})"
            if extraction.doctor_details.hospital_or_clinic:
                doc_str += f" - {extraction.doctor_details.hospital_or_clinic}"
            other_text.insert(1 if len(other_text) > 0 else 0, doc_str)

        if extraction.chief_complaints:
            other_text.append(f"Chief Complaints: {', '.join(extraction.chief_complaints)}")

        return DraftExtractionResponse(
            status="success",
            message=f"{len(items)} medicine(s) extracted from prescription for review",
            search_performed=False,
            model=getattr(provider, "model", "Gemini Vision"),
            file_name=document.filename,
            extraction=ExtractionDataSchema(
                document_language="en",
                items=items,
                other_text=other_text,
                warnings=warnings,
                patient_details=extraction.patient_details,
                doctor_details=extraction.doctor_details,
                chief_complaints=extraction.chief_complaints,
            ),
        )

    def search_confirmed(self, items: list[ConfirmedMedicineItem]) -> dict[str, Any]:
        """Match human-confirmed medicines against the medicine catalogue.
        Calculates savings across Private Brand, Jan Aushadhi, and Dava India.
        """
        all_catalogue = self.medicine_service.all()
        confirmed_results = []

        for item in items:
            name = item.medicine_name.strip()
            if not name:
                continue

            extracted = ExtractedMedicine(
                prescribed_name=name,
                normalized_name=" ".join(name.split()),
                strength=item.strength,
                dosage_form=item.dosage_form,
            )
            match = match_medicine(extracted, all_catalogue)

            matched_medicines = []
            if match.medicine_id is not None:
                row = self.medicine_service.get(match.medicine_id)
                if row:
                    matched_medicines.append(row)

            # Include high-confidence candidate alternatives if any
            for alt in match.alternatives:
                if alt.medicine_id != match.medicine_id and len(matched_medicines) < 3:
                    alt_row = self.medicine_service.get(alt.medicine_id)
                    if alt_row and alt_row not in matched_medicines:
                        matched_medicines.append(alt_row)

            matches_formatted = []
            for row in matched_medicines:
                comparison = compare_prices(row)
                prices = comparison["prices"]
                savings_source = comparison["savings_comparison"]
                max_s = savings_source["maximum_savings"]

                price_options = [
                    {
                        "provider": "Private Brand",
                        "price": prices["private_brand"],
                        "available": prices["private_brand"] is not None,
                        "is_cheapest": comparison["cheapest_provider"] == "Private Brand",
                        "savings_vs_private": None,
                        "savings_percent": None,
                    },
                    {
                        "provider": "Jan Aushadhi",
                        "price": prices["jan_aushadhi"],
                        "available": prices["jan_aushadhi"] is not None,
                        "is_cheapest": comparison["cheapest_provider"] == "Jan Aushadhi",
                        "savings_vs_private": savings_source["jan_aushadhi"]["savings_amount"],
                        "savings_percent": savings_source["jan_aushadhi"]["savings_percentage"],
                    },
                    {
                        "provider": "Dava India",
                        "price": prices["dava_india"],
                        "available": prices["dava_india"] is not None,
                        "is_cheapest": comparison["cheapest_provider"] == "Dava India",
                        "savings_vs_private": savings_source["dava_india"]["savings_amount"],
                        "savings_percent": savings_source["dava_india"]["savings_percentage"],
                    },
                ]

                rec_opt = None
                if max_s and max_s["amount"] is not None and max_s["amount"] > 0:
                    provider_name = max_s["provider"] if isinstance(max_s["provider"], str) else max_s["provider"][0]
                    rec_opt = {
                        "provider": provider_name,
                        "price": max_s["alternative_price"],
                        "savings": max_s["amount"],
                        "savings_percent": max_s["percentage"],
                    }

                note = (
                    f"Save up to {round(max_s['percentage'])}% with generic options."
                    if max_s and max_s.get("percentage")
                    else "Public generic alternative available."
                )

                matches_formatted.append(
                    {
                        "medicine": {
                            "id": row["id"],
                            "brand_name": row["brand_name"],
                            "active_salt": row["active_salt"],
                            "dosage_form": row["dosage_form"],
                            "category": row.get("category", "General"),
                            "private_brand_price": prices["private_brand"],
                            "jan_aushadhi_price": prices["jan_aushadhi"],
                            "dava_india_price": prices["dava_india"],
                        },
                        "price_options": price_options,
                        "recommended_option": rec_opt,
                        "comparison_note": note,
                    }
                )

            confirmed_results.append(
                {
                    "confirmed_input": {
                        "medicine_name": item.medicine_name,
                        "strength": item.strength,
                        "dosage_form": item.dosage_form,
                    },
                    "match_count": len(matches_formatted),
                    "review_note": (
                        "Direct active generic substitutes available in PMBJP catalogue."
                        if len(matches_formatted) > 0
                        else "No exact catalogue match found for this formulation. Consult your pharmacist."
                    ),
                    "matches": matches_formatted,
                }
            )

        return {
            "status": "success",
            "note": "Price comparisons matching loaded public generic catalogue and online retailers.",
            "results": confirmed_results,
        }

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
        total_savings = round(
            sum(
                item["savings_comparison"]["maximum_savings"]["amount"]
                for item in medicine_results
                if item["catalogue_match"]["status"] == "matched"
                and item["savings_comparison"]["maximum_savings"]["amount"] is not None
                and item["savings_comparison"]["maximum_savings"]["amount"] > 0
            ),
            2,
        )
        prescription_id = str(uuid4())
        summary = {
            "total_medicines_detected": len(medicine_results),
            "matched_medicines": matched,
            "unmatched_medicines": unmatched,
            "jan_aushadhi_prices_available": sum(
                item["prices"]["jan_aushadhi"] is not None for item in medicine_results
            ),
            "dava_india_prices_available": sum(
                item["prices"]["dava_india"] is not None for item in medicine_results
            ),
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
        matched_row = (
            self.medicine_service.get(match.medicine_id)
            if match.status == "matched" and match.medicine_id is not None
            else None
        )

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
            "raw_text": extracted.raw_text or extracted.prescribed_name,
            "prescribed_name": extracted.prescribed_name,
            "normalized_name": normalized_name,
            "active_salt": extracted.active_salt,
            "strength": extracted.strength,
            "dosage_form": extracted.dosage_form,
            "dosage_instructions": extracted.dosage_instructions,
            "duration": extracted.duration,
            "extraction_confidence": extracted.confidence,
            "uncertain_parts": extracted.uncertain_parts,
            "needs_review": extracted.needs_review,
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
