import uuid
from datetime import datetime, timezone
import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.dependencies import get_current_user, get_optional_current_user
from app.models.user_models import PrivacyConsent, User
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
async def get_consent(
    request: Request,
    patient_id: str | None = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Returns memory consent status.
    Unauthenticated users are always unconsented (consent: False, authenticated: False).
    """
    meko = _meko(request)
    if not current_user:
        pid = patient_id or DEFAULT_PATIENT_ID
        return {
            "patient_id": pid,
            "consent": False,
            "authenticated": False,
            "enabled": getattr(getattr(meko, "config", None), "enabled", False) if meko else False,
            "meko_available": getattr(meko, "is_available", False) if meko else False,
        }

    pid = str(current_user.id)
    # Check DB consent state with fallback to in-memory
    is_granted = False
    try:
        user_uuid = current_user.id if isinstance(current_user.id, uuid.UUID) else uuid.UUID(str(current_user.id))
        stmt = (
            select(PrivacyConsent)
            .where(
                PrivacyConsent.user_id == user_uuid,
                PrivacyConsent.purpose == "meko_patient_memory",
            )
            .order_by(PrivacyConsent.created_at.desc())
        )
        result = await session.execute(stmt)
        consent_record = result.scalar_one_or_none()
        if consent_record is not None:
            is_granted = consent_record.granted
        elif meko is not None:
            is_granted = meko.is_consented(pid)
    except Exception as e:
        logger.warning(f"Could not fetch privacy consent from DB (fallback to in-memory): {e}")
        if meko is not None:
            is_granted = meko.is_consented(pid)

    if meko is not None:
        meko.set_consent(is_granted, pid)

    return {
        "patient_id": pid,
        "consent": is_granted,
        "authenticated": True,
        "role": getattr(current_user, "role", "patient"),
        "enabled": getattr(getattr(meko, "config", None), "enabled", False) if meko else False,
        "meko_available": getattr(meko, "is_available", False) if meko else False,
    }


@router.post("/consent")
async def set_consent(
    request: Request,
    body: MemoryConsentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Toggles patient conversational memory consent.
    AUTHENTICATION ENFORCEMENT: Users must be authenticated to enable/configure persistent health memory.
    """
    meko = _meko(request)
    pid = str(current_user.id)

    # 1. Update audit-grade PrivacyConsent in database
    try:
        user_uuid = current_user.id if isinstance(current_user.id, uuid.UUID) else uuid.UUID(str(current_user.id))
        now = datetime.now(timezone.utc)
        stmt = (
            select(PrivacyConsent)
            .where(
                PrivacyConsent.user_id == user_uuid,
                PrivacyConsent.purpose == "meko_patient_memory",
            )
        )
        result = await session.execute(stmt)
        consent = result.scalar_one_or_none()
        if not consent:
            consent = PrivacyConsent(
                user_id=user_uuid,
                purpose="meko_patient_memory",
                policy_version="2026-10-v1",
                granted=body.consent,
                granted_at=now if body.consent else None,
                withdrawn_at=now if not body.consent else None,
            )
            session.add(consent)
        else:
            consent.granted = body.consent
            if body.consent:
                consent.granted_at = now
                consent.withdrawn_at = None
            else:
                consent.withdrawn_at = now

        await session.commit()
        await session.refresh(consent)
    except Exception as e:
        try:
            await session.rollback()
        except Exception:
            pass
        logger.warning(f"Could not persist privacy consent to DB (fallback to in-memory): {e}")

    # 2. Update Meko in-memory state
    updated = meko.set_consent(body.consent, pid) if meko else body.consent
    return {
        "success": True,
        "patient_id": pid,
        "consent": updated,
        "role": getattr(current_user, "role", "patient"),
        "message": f"Memory consent set to {updated}.",
    }


@router.post("/recall")
async def recall_memory(
    request: Request,
    body: MemoryRecallRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    meko = _meko(request)
    pid = body.patient_id or (str(current_user.id) if current_user else DEFAULT_PATIENT_ID)
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
async def reset_memory(
    request: Request,
    body: MemoryResetRequest | None = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    meko = _meko(request)
    pid = (body.patient_id if body else None) or (str(current_user.id) if current_user else DEFAULT_PATIENT_ID)
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
