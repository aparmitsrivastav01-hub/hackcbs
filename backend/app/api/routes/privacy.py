import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.dependencies import get_current_user
from app.models.auth_schemas import (
    ConsentUpdateRequest,
    ConsentWithdrawResponse,
    PrivacyConsentPublic,
)
from app.models.user_models import MekoDatapackLink, PrivacyConsent, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/privacy/consent", tags=["Privacy & Consent Management"])

MEKO_PURPOSE = "meko_patient_memory"
CURRENT_POLICY_VERSION = "2026-10-v1"


@router.get("", response_model=PrivacyConsentPublic)
async def get_consent_status(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Returns current audit-grade Meko memory consent state for the authenticated patient.
    """
    stmt = (
        select(PrivacyConsent)
        .where(
            PrivacyConsent.user_id == current_user.id,
            PrivacyConsent.purpose == MEKO_PURPOSE,
        )
        .order_by(PrivacyConsent.created_at.desc())
    )
    result = await session.execute(stmt)
    consent = result.scalar_one_or_none()

    if not consent:
        # Default ungranted consent state
        return PrivacyConsentPublic(
            purpose=MEKO_PURPOSE,
            policy_version=CURRENT_POLICY_VERSION,
            granted=False,
            granted_at=None,
            withdrawn_at=None,
        )

    return PrivacyConsentPublic.model_validate(consent)


@router.put("/meko-memory", response_model=PrivacyConsentPublic)
async def update_meko_consent(
    body: ConsentUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Explicitly grants or updates Meko memory consent.
    Stores timestamps and the exact policy version agreed to.
    """
    stmt = select(PrivacyConsent).where(
        PrivacyConsent.user_id == current_user.id,
        PrivacyConsent.purpose == MEKO_PURPOSE,
    )
    result = await session.execute(stmt)
    consent = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not consent:
        consent = PrivacyConsent(
            user_id=current_user.id,
            purpose=MEKO_PURPOSE,
            policy_version=body.policy_version or CURRENT_POLICY_VERSION,
            granted=body.granted,
            granted_at=now if body.granted else None,
            withdrawn_at=now if not body.granted else None,
        )
        session.add(consent)
    else:
        consent.policy_version = body.policy_version or CURRENT_POLICY_VERSION
        consent.granted = body.granted
        if body.granted:
            consent.granted_at = now
            consent.withdrawn_at = None
        else:
            consent.withdrawn_at = now

    await session.commit()
    await session.refresh(consent)

    return PrivacyConsentPublic.model_validate(consent)


@router.delete("/meko-memory", response_model=ConsentWithdrawResponse)
async def withdraw_meko_consent(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Withdraws Meko memory consent, halts all future context queries/writes,
    and flags the associated patient Meko datapack for deletion.
    """
    now = datetime.now(timezone.utc)

    # 1. Update privacy consent record
    stmt = select(PrivacyConsent).where(
        PrivacyConsent.user_id == current_user.id,
        PrivacyConsent.purpose == MEKO_PURPOSE,
    )
    result = await session.execute(stmt)
    consent = result.scalar_one_or_none()

    if consent:
        consent.granted = False
        consent.withdrawn_at = now
    else:
        consent = PrivacyConsent(
            user_id=current_user.id,
            purpose=MEKO_PURPOSE,
            policy_version=CURRENT_POLICY_VERSION,
            granted=False,
            withdrawn_at=now,
        )
        session.add(consent)

    # 2. Check for linked Meko datapack and queue for deletion
    link_stmt = select(MekoDatapackLink).where(MekoDatapackLink.user_id == current_user.id)
    link_result = await session.execute(link_stmt)
    meko_link = link_result.scalar_one_or_none()

    cleanup_status = "none"
    if meko_link:
        meko_link.status = "deleting"
        cleanup_status = "datapack_deletion_queued"

    await session.commit()

    return ConsentWithdrawResponse(
        success=True,
        purpose=MEKO_PURPOSE,
        granted=False,
        withdrawn_at=now,
        meko_cleanup_status=cleanup_status,
        message="Meko memory consent withdrawn. Remote memories queued for permanent deletion.",
    )
