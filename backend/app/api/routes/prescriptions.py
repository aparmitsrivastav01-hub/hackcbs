from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.models.prescription_schemas import (
    PrescriptionMedicinesResponse,
    PrescriptionRecordResponse,
    PrescriptionScanResponse,
    PrescriptionSummary,
)
from app.services.prescription.document_service import (
    DocumentValidationError,
    UnsupportedDocumentFormat,
    UploadTooLarge,
    validate_document,
)
from app.services.prescription.extraction_service import (
    ExtractionProviderError,
    ExtractionProviderTimeout,
    MissingProviderConfiguration,
)
from app.services.prescription.prescription_service import PrescriptionService

router = APIRouter(prefix="/api/prescriptions", tags=["prescriptions"])


def get_prescription_service(request: Request) -> PrescriptionService:
    return request.app.state.prescription_service


@router.post("/scan", response_model=PrescriptionScanResponse, status_code=status.HTTP_200_OK)
async def scan_prescription(
    file: UploadFile = File(..., description="JPG, JPEG, PNG, WEBP, or PDF; maximum 10 MB"),
    service: PrescriptionService = Depends(get_prescription_service),
):
    content = await file.read(10 * 1024 * 1024 + 1)
    try:
        document = validate_document(content, file.filename)
    except UploadTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UnsupportedDocumentFormat as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except DocumentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        await file.close()

    try:
        return await service.scan(document)
    except MissingProviderConfiguration as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ExtractionProviderTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ExtractionProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{prescription_id}", response_model=PrescriptionRecordResponse)
def get_prescription(
    prescription_id: str,
    service: PrescriptionService = Depends(get_prescription_service),
):
    record = service.get(prescription_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Prescription not found in temporary in-memory storage")
    return record


@router.get("/{prescription_id}/medicines", response_model=PrescriptionMedicinesResponse)
def get_prescription_medicines(
    prescription_id: str,
    service: PrescriptionService = Depends(get_prescription_service),
):
    record = service.get_medicines(prescription_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Prescription not found in temporary in-memory storage")
    return record


@router.get("/{prescription_id}/summary", response_model=PrescriptionSummary)
def get_prescription_summary(
    prescription_id: str,
    service: PrescriptionService = Depends(get_prescription_service),
):
    record = service.get_summary(prescription_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Prescription not found in temporary in-memory storage")
    return record
