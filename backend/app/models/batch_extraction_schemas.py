from typing import Literal
from pydantic import BaseModel, Field


class FieldConfidence(BaseModel):
    medicine_name: float | None = Field(default=None, ge=0, le=1)
    batch_number: float | None = Field(default=None, ge=0, le=1)
    manufacturer: float | None = Field(default=None, ge=0, le=1)
    expiry_date: float | None = Field(default=None, ge=0, le=1)


class BatchMedicineExtraction(BaseModel):
    medicine_name: str | None = None
    strength: str | None = None
    dosage_form: str | None = None
    manufacturer: str | None = None
    batch_number: str | None = None
    manufacturing_date: str | None = None
    expiry_date: str | None = None
    mrp: str | None = None
    composition: str | None = None
    raw_ocr_text: str = ""
    field_confidence: FieldConfidence = Field(default_factory=FieldConfidence)
    needs_manual_review: bool = True
    warnings: list[str] = Field(default_factory=list)
    extraction_status: Literal["complete", "partial", "failed"] = "partial"
    model: str | None = None


class BatchVerifyRequest(BaseModel):
    medicine_name: str | None = Field(default=None, max_length=300)
    batch_number: str | None = Field(default=None, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=500)


class BatchVerifyResponse(BaseModel):
    status: Literal["MATCH_FOUND", "NO_MATCH", "INSUFFICIENT_DATA"]
    match_type: str | None = None
    batch_number: str | None = None
    records: list[dict] = Field(default_factory=list)
    explanation: str
