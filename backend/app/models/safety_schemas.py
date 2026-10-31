from typing import Literal
from pydantic import BaseModel, Field, HttpUrl

SafetyStatus = Literal["CLEAR", "NSQ_FLAGGED", "NEEDS_REVIEW", "INSUFFICIENT_DATA"]


class SafetyDatasetStatusResponse(BaseModel):
    success: bool
    dataset_file: str
    dataset_path: str
    records_loaded: int
    review_pending_count: int
    verified_count: int
    dataset_latest_notice_month: str | None
    ready: bool


class SafetyAlert(BaseModel):
    alert_id: str
    notice_month: str | None
    serial_no: str | None
    product_name: str | None
    batch_number: str | None
    manufacturing_date: str | None
    expiry_date: str | None
    manufacturer: str | None
    nsq_result: str | None
    reported_by: str | None
    source_pdf: str | None
    extraction_text: str | None = None
    review_status: str | None
    verification_status: str
    official_source_url: str
    verification_notes: str | None = None
    verified_at: str | None = None


class SafetyCheckResponse(BaseModel):
    success: bool
    safety_status: SafetyStatus
    can_be_sold: bool | None
    can_be_dispensed: bool | None
    product_name: str | None
    batch_number: str | None
    manufacturer: str | None
    alert: SafetyAlert | None
    possible_alerts: list[SafetyAlert] = Field(default_factory=list)
    action_required: str
    batch_match_confirmed: bool
    dataset_latest_notice_month: str | None
    safety_disclaimer: str
    warning: str | None = None


class MedicineSafetySearchResponse(BaseModel):
    success: bool
    safety_status: SafetyStatus
    result_type: Literal["medicine_level_search"] = "medicine_level_search"
    batch_match_confirmed: bool = False
    medicine_name: str
    total_relevant_alerts: int
    alerts: list[SafetyAlert]
    dataset_latest_notice_month: str | None
    safety_disclaimer: str
    warning: str | None = None


class SafetyAlertsResponse(BaseModel):
    success: bool
    total_alerts: int
    offset: int
    limit: int
    dataset_latest_notice_month: str | None
    alerts: list[SafetyAlert]


class SafetyReviewRequest(BaseModel):
    official_source_url: HttpUrl
    verification_notes: str = Field(min_length=10, max_length=1000)
    product_name: str | None = Field(default=None, max_length=300)
    batch_number: str | None = Field(default=None, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=500)
    manufacturing_date: str | None = Field(default=None, max_length=80)
    expiry_date: str | None = Field(default=None, max_length=80)
    nsq_result: str | None = Field(default=None, max_length=300)
