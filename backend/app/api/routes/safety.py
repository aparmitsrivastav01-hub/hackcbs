import hmac
import os
import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel

from app.db.dependencies import get_optional_current_user
from app.models.safety_schemas import (
    MedicineSafetySearchResponse,
    SafetyAlertsResponse,
    SafetyCheckResponse,
    SafetyReviewRequest,
    SafetyAlert,
    SafetyDatasetStatusResponse,
)
from app.models.user_models import User
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


class BatchCheckPostRequest(BaseModel):
    product_name: str | None = None
    batch_number: str
    manufacturer: str | None = None


@batch_safety_router.post("/check")
def check_batch_post(
    body: BatchCheckPostRequest,
    service: CDSCOSafetyService = Depends(get_safety_service),
):
    res = service.check_batch(body.product_name, body.batch_number, body.manufacturer)
    alerts = []
    if res.get("alert"):
        alerts.append(res["alert"])
    if res.get("possible_alerts"):
        alerts.extend(res["possible_alerts"])

    status_str = "alert_match" if res.get("safety_status") in ("RECALL_CONFIRMED", "MATCH_FOUND") else (
        "manual_review" if res.get("safety_status") == "NEEDS_REVIEW" else "no_match"
    )

    matches = []
    for a in alerts:
        matches.append({
            "product_name": a.get("product_name") or body.product_name or "",
            "manufacturer": a.get("manufacturer") or body.manufacturer or "",
            "batch_number": a.get("batch_number") or body.batch_number,
            "alert_type": a.get("nsq_result") or "Not of Standard Quality (NSQ)",
            "notice_date": a.get("notice_month") or a.get("manufacturing_date") or "",
            "source_name": "Central Drugs Standard Control Organisation (CDSCO)",
            "source_url": a.get("official_source_url") or "https://cdsco.gov.in",
            "notes": a.get("nsq_result") or a.get("review_status") or "",
        })

    return {
        "status": status_str,
        "product_name": body.product_name or "",
        "manufacturer": body.manufacturer,
        "batch_number": body.batch_number,
        "matches": matches,
        "dataset_records": service.count,
        "last_updated": service.latest_notice_month or "October 2026",
        "message": res.get("warning") or ("ALERT MATCH FOUND: This batch was flagged in official CDSCO alert reports." if matches else "No matching record in CDSCO NSQ dataset."),
        "safety_note": res.get("safety_disclaimer") or "Do not consume medicines from flagged batches. Consult your doctor or pharmacist.",
    }


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
    current_user: Optional[User] = Depends(get_optional_current_user),
    service: CDSCOSafetyService = Depends(get_safety_service),
):
    # RBAC: Authorized if user is an authenticated pharmacist or admin
    if current_user:
        if getattr(current_user, "role", "patient") not in ("pharmacist", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Access denied: CDSCO safety recall verification requires 'pharmacist' or 'admin' role.",
            )
    else:
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

# Image first extraction and user reviewed verification endpoints.
from fastapi import File, UploadFile, status
from app.models.batch_extraction_schemas import BatchMedicineExtraction, BatchVerifyRequest, BatchVerifyResponse
from app.services.prescription.document_service import (
    DocumentValidationError, UnsupportedDocumentFormat, UploadTooLarge, validate_document,
)
from app.services.batch_extraction_service import BatchExtractionService


def get_batch_extractor(request: Request) -> BatchExtractionService:
    if not hasattr(request.app.state, "batch_extraction_service"):
        request.app.state.batch_extraction_service = BatchExtractionService()
    return request.app.state.batch_extraction_service


@batch_safety_router.get("/dataset-info")
def dataset_info(service: CDSCOSafetyService = Depends(get_safety_service)):
    status = service.dataset_status()
    status["source"] = "CDSCO Monthly NSQ Dataset"
    status["last_update_date"] = status.get("dataset_latest_notice_month")
    return status


@batch_safety_router.post("/extract", response_model=BatchMedicineExtraction)
async def extract_batch_details(
    files: list[UploadFile] = File(..., description="JPG, JPEG, PNG, WEBP, or PDF; maximum 10 MB each"),
    extractor: BatchExtractionService = Depends(get_batch_extractor),
):
    if not files or len(files) > 5:
        raise HTTPException(status_code=400, detail="Upload between 1 and 5 packaging images or PDFs")
    documents = []
    try:
        for file in files:
            content = await file.read(10 * 1024 * 1024 + 1)
            documents.append(validate_document(content, file.filename))
    except UploadTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UnsupportedDocumentFormat as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except DocumentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        for file in files:
            await file.close()
    try:
        return await extractor.extract(documents)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Image extraction failed. Please retry or enter details from a clearer photo.") from exc


@batch_safety_router.post("/verify", response_model=BatchVerifyResponse)
def verify_batch(payload: BatchVerifyRequest, service: CDSCOSafetyService = Depends(get_safety_service)):
    batch = re.sub(r"\s+", " ", (payload.batch_number or "").strip()).casefold()
    product = re.sub(r"\s+", " ", (payload.medicine_name or "").strip()).casefold()
    manufacturer = re.sub(r"\s+", " ", (payload.manufacturer or "").strip()).casefold()
    if not batch:
        return {"status": "INSUFFICIENT_DATA", "batch_number": payload.batch_number,
                "explanation": "A readable batch number is required for exact verification."}
    if not (payload.medicine_name or "").strip():
        return {"status": "INSUFFICIENT_DATA", "batch_number": payload.batch_number,
                "explanation": "Medicine identity is needed to interpret an exact batch number safely. Enter or confirm the medicine name from the packaging."}
    rows = [row for row in service._rows if re.sub(r"\s+", " ", str(row.get("batch_number") or "").strip()).casefold() == batch]
    if not rows:
        return {"status": "NO_MATCH", "batch_number": payload.batch_number, "records": [],
                "explanation": "No matching record was found in the currently loaded CDSCO NSQ dataset. Absence from this dataset is not proof of safety."}
    records = [service._public_record(row) for row in rows]
    from app.services.cdsco_safety_service import normalize_product, normalize_manufacturer
    product_key = normalize_product(payload.medicine_name)
    manufacturer_key = normalize_manufacturer(payload.manufacturer)
    identities = [row for row in rows if (not product_key or not row.get("_product_normalized") or product_key == row.get("_product_normalized") or product_key in row.get("_product_normalized", "") or row.get("_product_normalized", "") in product_key)
                  and (not manufacturer_key or not row.get("_manufacturer_normalized") or manufacturer_key == row.get("_manufacturer_normalized") or manufacturer_key in row.get("_manufacturer_normalized", "") or row.get("_manufacturer_normalized", "") in manufacturer_key)]
    confirmed = bool(identities and product_key)
    if not confirmed:
        return {"status": "INSUFFICIENT_DATA", "match_type": "exact_batch_identity_review", "batch_number": payload.batch_number,
                "records": records, "explanation": "The batch number appears in CDSCO NSQ records, but the medicine identity is missing or conflicts with the record. Review the packaging and source notice before treating this as a match."}
    return {"status": "MATCH_FOUND", "match_type": "exact_batch_and_identity" if manufacturer_key else "exact_batch_and_product",
            "batch_number": payload.batch_number, "records": records,
            "explanation": "This batch number and medicine identity appear in the loaded CDSCO NSQ records. Verify the details with the manufacturer, pharmacist, or relevant authority."}
