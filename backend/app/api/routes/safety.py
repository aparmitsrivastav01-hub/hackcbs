import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from app.models.safety_schemas import (
    MedicineSafetySearchResponse,
    SafetyAlertsResponse,
    SafetyCheckResponse,
    SafetyReviewRequest,
    SafetyAlert,
    SafetyDatasetStatusResponse,
)
from app.services.cdsco_safety_service import CDSCOSafetyService

router = APIRouter(prefix="/api/safety", tags=["batch safety"])
batch_safety_router = APIRouter(prefix="/api/batch-safety", tags=["batch safety"])


def get_safety_service(request: Request) -> CDSCOSafetyService:
    return request.app.state.safety_service


@batch_safety_router.get("/dataset-status", response_model=SafetyDatasetStatusResponse)
def dataset_status(service: CDSCOSafetyService = Depends(get_safety_service)):
    status = service.dataset_status()
    if not status["ready"]:
        raise HTTPException(status_code=503, detail="CDSCO safety dataset is not loaded")
    return status


@router.get("/check-batch", response_model=SafetyCheckResponse)
@batch_safety_router.get("/check-batch", response_model=SafetyCheckResponse)
def check_batch(
    product_name: str | None = Query(default=None, max_length=300),
    batch_number: str | None = Query(default=None, max_length=120),
    manufacturer: str | None = Query(default=None, max_length=500),
    service: CDSCOSafetyService = Depends(get_safety_service),
):
    return service.check_batch(product_name, batch_number, manufacturer)


@router.get("/check-medicine", response_model=MedicineSafetySearchResponse)
def check_medicine(
    medicine_name: str = Query(min_length=1, max_length=300),
    service: CDSCOSafetyService = Depends(get_safety_service),
):
    try:
        return service.check_medicine(medicine_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/alerts", response_model=SafetyAlertsResponse)
@batch_safety_router.get("/alerts", response_model=SafetyAlertsResponse)
def list_alerts(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    service: CDSCOSafetyService = Depends(get_safety_service),
):
    return {
        "success": True,
        "total_alerts": service.count,
        "offset": offset,
        "limit": limit,
        "dataset_latest_notice_month": service.latest_notice_month,
        "alerts": service.list_alerts(offset, limit),
    }


@router.get("/alerts/{alert_id}", response_model=SafetyAlert)
def get_alert(alert_id: str, service: CDSCOSafetyService = Depends(get_safety_service)):
    alert = service.get_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="CDSCO alert record not found")
    return alert


@router.patch("/alerts/{alert_id}/review", response_model=SafetyAlert)
def review_alert(
    alert_id: str,
    body: SafetyReviewRequest,
    x_cdsco_review_key: str | None = Header(default=None),
    service: CDSCOSafetyService = Depends(get_safety_service),
):
    configured_key = os.getenv("CDSCO_REVIEW_API_KEY")
    if not configured_key:
        raise HTTPException(status_code=503, detail="Manual CDSCO review is not configured")
    if not x_cdsco_review_key or not hmac.compare_digest(x_cdsco_review_key, configured_key):
        raise HTTPException(status_code=403, detail="Reviewer authentication failed")
    try:
        corrections = {name: getattr(body, name) for name in (
            "product_name", "batch_number", "manufacturer", "manufacturing_date", "expiry_date", "nsq_result",
        ) if name in body.model_fields_set}
        result = service.review_alert(
            alert_id,
            official_source_url=str(body.official_source_url),
            verification_notes=body.verification_notes,
            corrections=corrections,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="CDSCO alert record not found")
    return result
