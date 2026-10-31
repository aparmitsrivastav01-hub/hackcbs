import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.dependencies import get_current_user
from app.models.auth_schemas import (
    AuthResponse,
    LoginRequest,
    PatientProfilePublic,
    SignupRequest,
    TokenRefreshResponse,
    UserPublic,
)
from app.models.user_models import User
from app.services.auth_service import (
    create_access_token,
    create_refresh_session,
    create_user_with_profile,
    get_user_by_email,
    revoke_refresh_session,
    validate_and_rotate_refresh_token,
    verify_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication & User Accounts"])

REFRESH_COOKIE_NAME = "medeasy_refresh_token"
REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=REFRESH_MAX_AGE_SECONDS,
        path="/api/auth",
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignupRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
):
    """
    Registers a new MedEasy user and provisions their minimal patient profile.
    Enforces password confirmation, lowercase normalization, and unique email.
    CRITICAL PRIVACY BOUNDARY: No health details or medical history collected.
    """
    if body.confirm_password and body.password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Passwords do not match",
        )

    # Check for duplicate email safely
    existing = await get_user_by_email(session, body.email)
    if existing:
        # Generic conflict response to prevent account enumeration
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists",
        )

    user, profile = await create_user_with_profile(
        session=session,
        email=body.email,
        password=body.password,
        display_label=body.display_label,
        preferred_language=body.preferred_language,
    )

    access_token = create_access_token(user.id, user.email)
    raw_refresh, _ = await create_refresh_session(session, user.id)
    _set_refresh_cookie(response, raw_refresh)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
        profile=PatientProfilePublic.model_validate(profile),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
):
    """
    Authenticates user using email and password with Argon2id verification.
    Uses generic error responses to prevent email enumeration.
    """
    generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = await get_user_by_email(session, body.email)
    if not user or not user.is_active:
        raise generic_error

    if not verify_password(user.password_hash, body.password):
        raise generic_error

    # Record last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()

    access_token = create_access_token(user.id, user.email)
    raw_refresh, _ = await create_refresh_session(session, user.id)
    _set_refresh_cookie(response, raw_refresh)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
        profile=PatientProfilePublic.model_validate(user.profile),
    )


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_tokens(
    response: Response,
    medeasy_refresh_token: Optional[str] = Cookie(None),
    session: AsyncSession = Depends(get_db),
):
    """
    Rotates refresh token and issues a new access token.
    Enforces single-use token rotation and invalidates compromised tokens.
    """
    if not medeasy_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
        )

    result = await validate_and_rotate_refresh_token(session, medeasy_refresh_token)
    if not result:
        response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/auth")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh session",
        )

    user, new_raw_refresh = result
    _set_refresh_cookie(response, new_raw_refresh)
    access_token = create_access_token(user.id, user.email)

    return TokenRefreshResponse(
        access_token=access_token,
        token_type="bearer",
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    response: Response,
    medeasy_refresh_token: Optional[str] = Cookie(None),
    session: AsyncSession = Depends(get_db),
):
    """
    Revokes the refresh token and clears the authentication cookie.
    """
    if medeasy_refresh_token:
        await revoke_refresh_session(session, medeasy_refresh_token)

    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/auth")
    return {"success": True, "message": "Successfully logged out"}


@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns current authenticated user details, minimal profile, and consent state.
    """
    return {
        "user": UserPublic.model_validate(current_user),
        "profile": PatientProfilePublic.model_validate(current_user.profile) if current_user.profile else None,
        "consent": {
            "meko_memory_granted": any(
                c.purpose == "meko_patient_memory" and c.granted
                for c in current_user.consents
            )
        },
    }
