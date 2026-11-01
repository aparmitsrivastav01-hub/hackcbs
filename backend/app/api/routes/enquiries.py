from datetime import datetime, timezone
import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.db.dependencies import get_optional_current_user
from app.models.user_models import User

router = APIRouter(prefix="/api/pharmacy-enquiries", tags=["enquiries"])

# In-memory store for session enquiries
_ENQUIRIES: dict[str, dict] = {}


class EnquiryItemPayload(BaseModel):
    medicine_name: str
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    quantity: str = "1"
    catalogue_medicine_id: Optional[int] = None


class CreateEnquiryPayload(BaseModel):
    pharmacy_name: str
    pharmacy_phone: Optional[str] = None
    pharmacy_address: Optional[str] = None
    customer_area: Optional[str] = None
    customer_message: Optional[str] = None
    items: List[EnquiryItemPayload] = Field(default_factory=list)


@router.post("")
async def create_enquiry(
    payload: CreateEnquiryPayload,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    enquiry_id = f"ENQ-{int(time.time() * 1000) % 1000000:06d}"
    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "id": enquiry_id,
        "created_at": now_iso,
        "updated_at": now_iso,
        "status": "sent",
        "user_id": str(current_user.id) if current_user else None,
        "user_email": current_user.email if current_user else None,
        "pharmacy_name": payload.pharmacy_name,
        "pharmacy_phone": payload.pharmacy_phone,
        "pharmacy_address": payload.pharmacy_address,
        "customer_area": payload.customer_area,
        "customer_message": payload.customer_message,
        "items": [item.dict() for item in payload.items],
        "verified_items": [],
    }
    _ENQUIRIES[enquiry_id] = record
    return {
        "status": "success",
        "whatsapp_sent": False,
        "enquiry": record,
    }


@router.get("")
async def list_enquiries(
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Role-based inquiry listing:
    - Pharmacists and admins see all inquiries sent to stores.
    - Patients see only inquiries they created.
    - Guests are prompted to sign in.
    """
    if not current_user:
        return {
            "count": 0,
            "items": [],
            "authenticated": False,
            "message": "Sign in required to view pharmacy enquiries.",
        }

    role = getattr(current_user, "role", "patient") or "patient"
    if role in ("pharmacist", "admin"):
        items = list(_ENQUIRIES.values())
    else:
        items = [e for e in _ENQUIRIES.values() if e.get("user_id") == str(current_user.id)]

    return {
        "count": len(items),
        "items": items,
        "role": role,
    }


@router.get("/{enquiry_id}")
async def get_enquiry(enquiry_id: str):
    if enquiry_id in _ENQUIRIES:
        return _ENQUIRIES[enquiry_id]
    return {"id": enquiry_id, "status": "not_found"}
