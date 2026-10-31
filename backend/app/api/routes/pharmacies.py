from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.models.pharmacy_schemas import (
    EnquiryCreateRequest,
    EnquiryStatusUpdate,
    EnquiryBatchVerifyRequest,
    NearbyPharmaciesRequest,
    NearbyPharmaciesResponse,
    PharmacyEnquiryRecord,
    PharmacyEnquiryResponse,
    PharmacyStore,
    ShopWhatsAppContactRequest,
    ShopWhatsAppContactResponse,
)
from app.services.pharmacy_service import PharmacyService
from app.services.tinyfish_service import TinyFishError, TinyFishNotConfigured, TinyFishTimeout

router = APIRouter(prefix="/api/pharmacies", tags=["pharmacies"])


def get_pharmacy_service(request: Request) -> PharmacyService:
    return request.app.state.pharmacy_service


@router.post("/nearby", response_model=NearbyPharmaciesResponse)
async def nearby_pharmacies(body: NearbyPharmaciesRequest, service: PharmacyService = Depends(get_pharmacy_service)):
    try:
        return await service.nearby(body)
    except TinyFishNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TinyFishTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except TinyFishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/whatsapp-contact", response_model=ShopWhatsAppContactResponse)
async def pharmacy_whatsapp_contact(
    body: ShopWhatsAppContactRequest,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    try:
        return await service.get_shop_whatsapp_contact(body)
    except TinyFishNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TinyFishTimeout as exc:
        raise HTTPException(status_code=504, detail="TinyFish contact discovery timed out") from exc
    except TinyFishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/enquiry/create", response_model=PharmacyEnquiryResponse, status_code=status.HTTP_201_CREATED)
def create_enquiry(body: EnquiryCreateRequest, service: PharmacyService = Depends(get_pharmacy_service)):
    try:
        return service.create_enquiry(body.store_id, body.cart_session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/enquiry/{enquiry_id}/verify-batch", response_model=PharmacyEnquiryRecord)
def verify_enquiry_batch(
    enquiry_id: str,
    body: EnquiryBatchVerifyRequest,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    try:
        result = service.verify_enquiry_batch(
            enquiry_id, body.cart_item_id, body.product_name, body.batch_number,
            body.manufacturer, body.expiry_date,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return result


@router.get("/enquiry/{enquiry_id}", response_model=PharmacyEnquiryRecord)
def get_enquiry(enquiry_id: str, service: PharmacyService = Depends(get_pharmacy_service)):
    enquiry = service.get_enquiry(enquiry_id)
    if enquiry is None:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return enquiry


@router.patch("/enquiry/{enquiry_id}/status", response_model=PharmacyEnquiryRecord)
def update_enquiry_status(enquiry_id: str, body: EnquiryStatusUpdate, service: PharmacyService = Depends(get_pharmacy_service)):
    enquiry = service.update_enquiry_status(enquiry_id, body.status)
    if enquiry is None:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return enquiry
