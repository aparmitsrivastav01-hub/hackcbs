import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.dependencies import get_current_user
from app.models.auth_schemas import PatientProfilePublic, PatientProfileUpdate
from app.models.user_models import PatientProfile, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/profile", tags=["Patient Profile"])


@router.get("", response_model=PatientProfilePublic)
async def get_patient_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated user's minimal patient profile.
    """
    if not current_user.profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    return PatientProfilePublic.model_validate(current_user.profile)


@router.patch("", response_model=PatientProfilePublic)
async def update_patient_profile(
    body: PatientProfileUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Updates permitted preferences (display alias or preferred language).
    CRITICAL SECURITY CHECK: user_id is derived strictly from authentication context.
    CRITICAL PRIVACY BOUNDARY: No clinical or health data is accepted or stored here.
    """
    profile = current_user.profile
    if not profile:
        profile = PatientProfile(user_id=current_user.id)
        session.add(profile)

    if body.display_label is not None:
        profile.display_label = body.display_label.strip()

    if body.preferred_language is not None:
        clean_lang = body.preferred_language.strip().lower()
        if clean_lang in ("en", "hi"):
            profile.preferred_language = clean_lang

    await session.commit()
    await session.refresh(profile)

    return PatientProfilePublic.model_validate(profile)
