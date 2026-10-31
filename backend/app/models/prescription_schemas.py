from typing import Literal
from pydantic import BaseModel, Field


class ExtractedMedicine(BaseModel):
    prescribed_name: str | None = None
    normalized_name: str | None = None
    active_salt: str | None = None
    strength: str | None = None
    dosage_form: str | None = None
    dosage_instructions: str | None = None
    duration: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)


class ExtractionResult(BaseModel):
    medicines: list[ExtractedMedicine] = Field(default_factory=list)


class CatalogueCandidate(BaseModel):
    medicine_id: int
    brand_name: str
    active_salt: str
    dosage_form: str
    match_confidence: float


class CatalogueMatch(BaseModel):
    status: Literal["matched", "possible_match", "not_found", "needs_review"]
    medicine_id: int | None = None
    brand_name: str | None = None
    active_salt: str | None = None
    dosage_form: str | None = None
    match_confidence: float | None = None
    alternatives: list[CatalogueCandidate] = Field(default_factory=list)


class PrescriptionSavings(BaseModel):
    amount: float | None
    percentage: float | None


class PrescriptionMaximumSavings(BaseModel):
    provider: str | list[str] | None
    amount: float | None
    percentage: float | None


class PrescriptionSavingsComparison(BaseModel):
    jan_aushadhi: PrescriptionSavings
    dava_india: PrescriptionSavings
    maximum_savings: PrescriptionMaximumSavings


class PrescriptionPrices(BaseModel):
    private_brand: float | None
    jan_aushadhi: float | None
    dava_india: float | None


class PrescriptionMedicine(BaseModel):
    prescribed_name: str | None
    normalized_name: str | None
    active_salt: str | None
    strength: str | None
    dosage_form: str | None
    dosage_instructions: str | None
    duration: str | None
    extraction_confidence: float | None
    catalogue_match: CatalogueMatch
    prices: PrescriptionPrices
    cheapest_provider: str | None
    savings_comparison: PrescriptionSavingsComparison


class PrescriptionSummary(BaseModel):
    total_medicines_detected: int
    matched_medicines: int
    unmatched_medicines: int
    jan_aushadhi_prices_available: int
    dava_india_prices_available: int
    total_potential_savings: float
    savings_label: Literal["potential savings, not guaranteed savings"] = "potential savings, not guaranteed savings"


class PrescriptionScanResponse(BaseModel):
    success: bool
    prescription_id: str
    total_medicines_detected: int
    matched_medicines: int
    unmatched_medicines: int
    total_potential_savings: float
    medicines: list[PrescriptionMedicine]


class PrescriptionRecordResponse(BaseModel):
    success: bool
    prescription_id: str
    total_medicines_detected: int
    matched_medicines: int
    unmatched_medicines: int
    total_potential_savings: float
    medicines: list[PrescriptionMedicine]
    summary: PrescriptionSummary


class PrescriptionMedicinesResponse(BaseModel):
    success: bool
    prescription_id: str
    total_medicines_detected: int
    medicines: list[PrescriptionMedicine]
