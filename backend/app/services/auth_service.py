import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user_models import (
    MekoDatapackLink,
    PatientProfile,
    PrivacyConsent,
    RefreshSession,
    User,
)

# Password Hasher using Argon2id (RFC 9106 recommended parameters)
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

JWT_SECRET = os.getenv("JWT_SECRET", "medeasy_dev_secret_key_minimum_32_bytes_long_123456")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


def hash_password(password: str) -> str:
    """Hashes password with Argon2id. Never stores or logs plaintext."""
    return _ph.hash(password)


def verify_password(hash_val: str, password: str) -> bool:
    """Safely verifies a password against an Argon2id hash."""
    try:
        return _ph.verify(hash_val, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: uuid.UUID, email: str, role: str = "patient") -> str:
    """Generates a short-lived cryptographically signed JWT access token."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email.lower(),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT token; returns None on signature/expiry failure."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def generate_refresh_token() -> tuple[str, str, datetime]:
    """
    Generates an opaque unguessable refresh token.
    Returns (raw_token, sha256_hash, expires_at).
    Only the sha256_hash is stored in the database.
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# -------------------------------------------------------------
# Database Operations
# -------------------------------------------------------------

async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    """Fetches user by normalized lowercase email with profile eagerly loaded."""
    stmt = (
        select(User)
        .options(selectinload(User.profile), selectinload(User.consents))
        .where(User.email == email.strip().lower())
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    """Fetches user by UUID with profile eagerly loaded."""
    stmt = (
        select(User)
        .options(selectinload(User.profile), selectinload(User.consents))
        .where(User.id == user_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_user_with_profile(
    session: AsyncSession,
    email: str,
    password: str,
    display_label: Optional[str] = None,
    preferred_language: str = "en",
    role: str = "patient",
) -> tuple[User, PatientProfile, str]:
    """
    Creates a new user account, associated minimal patient profile, default privacy consent,
    and refresh session in a single atomic database transaction.
    CRITICAL PRIVACY BOUNDARY: No health or medical history fields are populated.
    """
    clean_email = email.strip().lower()
    hashed_pwd = hash_password(password)

    user_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    consent_id = uuid.uuid4()
    session_id = uuid.uuid4()

    user = User(
        id=user_id,
        email=clean_email,
        role=role or "patient",
        password_hash=hashed_pwd,
        is_active=True,
    )

    profile = PatientProfile(
        id=profile_id,
        user_id=user_id,
        display_label=display_label or "My Health Profile",
        preferred_language=preferred_language or "en",
    )

    consent = PrivacyConsent(
        id=consent_id,
        user_id=user_id,
        purpose="meko_patient_memory",
        policy_version="2026-10-v1",
        granted=False,
    )

    raw_token, token_hash, expires_at = generate_refresh_token()
    refresh_session = RefreshSession(
        id=session_id,
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    # Attach relationships in memory so caller can serialize immediately
    user.profile = profile
    user.consents = [consent]
    user.refresh_sessions = [refresh_session]

    session.add_all([user, profile, consent, refresh_session])
    await session.commit()

    return user, profile, raw_token


async def create_refresh_session(
    session: AsyncSession, user_id: uuid.UUID
) -> tuple[str, RefreshSession]:
    """Creates a refresh session, persisting only the hash of the token."""
    raw_token, token_hash, expires_at = generate_refresh_token()
    refresh_session = RefreshSession(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(refresh_session)
    await session.commit()
    return raw_token, refresh_session


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime has timezone info for safe comparison across DB dialects."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def validate_and_rotate_refresh_token(
    session: AsyncSession, raw_token: str
) -> Optional[tuple[User, str]]:
    """
    Validates an incoming refresh token against its stored hash.
    Performs single-use token rotation: revokes old session and creates a new one.
    """
    token_hash = hash_refresh_token(raw_token)
    stmt = (
        select(RefreshSession)
        .options(selectinload(RefreshSession.user).selectinload(User.profile))
        .where(RefreshSession.token_hash == token_hash)
    )
    result = await session.execute(stmt)
    refresh_session = result.scalar_one_or_none()

    if not refresh_session:
        return None

    now = datetime.now(timezone.utc)
    expires_at_utc = ensure_utc(refresh_session.expires_at)
    # Check if revoked or expired
    if refresh_session.revoked_at is not None or (expires_at_utc and expires_at_utc <= now):
        return None

    user = refresh_session.user
    if not user or not user.is_active:
        return None

    # Revoke current token (single-use rotation)
    refresh_session.revoked_at = now
    refresh_session.last_used_at = now

    # Create new refresh session
    new_raw_token, _, new_expires_at = generate_refresh_token()
    new_token_hash = hash_refresh_token(new_raw_token)
    new_session = RefreshSession(
        user_id=user.id,
        token_hash=new_token_hash,
        expires_at=new_expires_at,
    )
    session.add(new_session)
    await session.commit()

    return user, new_raw_token


async def revoke_refresh_session(session: AsyncSession, raw_token: str) -> bool:
    """Revokes the refresh token upon logout."""
    token_hash = hash_refresh_token(raw_token)
    stmt = select(RefreshSession).where(RefreshSession.token_hash == token_hash)
    result = await session.execute(stmt)
    refresh_session = result.scalar_one_or_none()
    if refresh_session and refresh_session.revoked_at is None:
        refresh_session.revoked_at = datetime.now(timezone.utc)
        await session.commit()
        return True
    return False


async def get_user_datapack_id(session: AsyncSession, user_id: uuid.UUID) -> Optional[str]:
    """
    Helper for teammate Meko workstream:
    Resolves the isolated Meko datapack ID for an authenticated user from YugabyteDB.
    Returns None if no active datapack is linked yet.
    """
    stmt = select(MekoDatapackLink).where(
        MekoDatapackLink.user_id == user_id,
        MekoDatapackLink.status == "active",
    )
    result = await session.execute(stmt)
    link = result.scalar_one_or_none()
    return link.datapack_id if link else None


async def link_user_datapack(
    session: AsyncSession, user_id: uuid.UUID, datapack_id: str
) -> MekoDatapackLink:
    """
    Helper for teammate Meko workstream:
    Links an isolated Meko datapack to an authenticated user upon provisioning.
    """
    user = await get_user_by_id(session, user_id)
    if not user or not user.profile:
        raise ValueError(f"Cannot link datapack: user or profile not found for {user_id}")

    stmt = select(MekoDatapackLink).where(MekoDatapackLink.user_id == user_id)
    result = await session.execute(stmt)
    link = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if link:
        link.datapack_id = datapack_id
        link.status = "active"
        link.updated_at = now
    else:
        link = MekoDatapackLink(
            user_id=user.id,
            patient_profile_id=user.profile.id,
            datapack_id=datapack_id,
            status="active",
        )
        session.add(link)

    await session.commit()
    await session.refresh(link)
    return link
