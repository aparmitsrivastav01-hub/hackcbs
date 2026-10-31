import logging
from typing import Any
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.services.meko_service import DEFAULT_PATIENT_ID, MekoService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/memory", tags=["Conversational Memory"])


class MemoryConsentRequest(BaseModel):
    consent: bool
    patient_id: str | None = None


class MemoryRecallRequest(BaseModel):
    query: str
    patient_id: str | None = None
    conversation_id: str | None = None


class MemoryResetRequest(BaseModel):
    patient_id: str | None = None
    conversation_id: str | None = None


def _meko(request: Request) -> MekoService:
    return getattr(request.app.state, "meko_service", None)


@router.get("/consent")
async def get_consent(request: Request, patient_id: str | None = None):
    meko = _meko(request)
    pid = patient_id or DEFAULT_PATIENT_ID
    if meko is None:
        return {
            "patient_id": pid,
            "consent": False,
            "enabled": False,
            "meko_available": False,
        }
    return {
        "patient_id": pid,
        "consent": meko.get_consent(pid),
        "enabled": meko.config.enabled,
        "meko_available": meko.is_available,
    }


@router.post("/consent")
async def set_consent(request: Request, body: MemoryConsentRequest):
    meko = _meko(request)
    pid = body.patient_id or DEFAULT_PATIENT_ID
    if meko is None:
        return {
            "success": False,
            "patient_id": pid,
            "consent": False,
            "message": "Meko memory service is not initialized.",
        }
    updated = meko.set_consent(body.consent, pid)
    return {
        "success": True,
        "patient_id": pid,
        "consent": updated,
        "message": f"Memory consent set to {updated}.",
    }


@router.post("/recall")
async def recall_memory(request: Request, body: MemoryRecallRequest):
    meko = _meko(request)
    pid = body.patient_id or DEFAULT_PATIENT_ID
    if meko is None or not meko.is_consented(pid):
        return {
            "success": True,
            "patient_id": pid,
            "items": [],
            "message": "Memory consent is disabled or service is unavailable; zero memory retrieved.",
        }

    context = await meko.recall(body.query, conversation_id=body.conversation_id, patient_id=pid)
    return {
        "success": True,
        "patient_id": pid,
        "items": [item.model_dump() for item in context.items],
        "unverified_disclaimer": "Retrieved material is unverified conversational context, not a clinical record.",
    }


@router.post("/reset")
async def reset_memory(request: Request, body: MemoryResetRequest | None = None):
    meko = _meko(request)
    pid = (body.patient_id if body else None) or DEFAULT_PATIENT_ID
    cid = body.conversation_id if body else None
    if meko is None:
        return {
            "success": True,
            "patient_id": pid,
            "consent": False,
            "message": "Memory reset complete.",
        }

    result = await meko.reset_memory(conversation_id=cid, patient_id=pid)
    return result
