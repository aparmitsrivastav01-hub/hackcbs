import uuid
from datetime import datetime, timezone, timedelta
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models.user_models import (
    MekoDatapackLink,
    PatientProfile,
    PrivacyConsent,
    RefreshSession,
    User,
)


@pytest_asyncio.fixture
async def async_test_session():
    """Provides an isolated in-memory SQLite database session for unit testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_maker() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_user_and_patient_profile_lifecycle(async_test_session: AsyncSession):
    """Verifies User creation, auto-generated UUID, and 1-to-1 PatientProfile creation."""
    user = User(
        email="patient@example.com",
        password_hash="$argon2id$v=19$m=65536,t=3,p=4$fakehash",
    )
    async_test_session.add(user)
    await async_test_session.commit()
    await async_test_session.refresh(user)

    assert isinstance(user.id, uuid.UUID)
    assert user.email == "patient@example.com"
    assert user.is_active is True
    assert user.created_at is not None

    # Create associated PatientProfile
    profile = PatientProfile(
        user_id=user.id,
        display_label="Test Patient Alias",
        preferred_language="en",
    )
    async_test_session.add(profile)
    await async_test_session.commit()
    await async_test_session.refresh(profile)

    assert isinstance(profile.id, uuid.UUID)
    assert profile.user_id == user.id
    assert profile.display_label == "Test Patient Alias"
    assert profile.preferred_language == "en"


@pytest.mark.asyncio
async def test_privacy_consent_lifecycle(async_test_session: AsyncSession):
    """Verifies that Meko privacy consent defaults to False and tracks timestamps."""
    user = User(
        email="consent_test@example.com",
        password_hash="$argon2id$fake",
    )
    async_test_session.add(user)
    await async_test_session.commit()

    consent = PrivacyConsent(
        user_id=user.id,
        purpose="meko_patient_memory",
        policy_version="2026-10-v1",
        granted=False,
    )
    async_test_session.add(consent)
    await async_test_session.commit()
    await async_test_session.refresh(consent)

    assert consent.granted is False
    assert consent.purpose == "meko_patient_memory"
    assert consent.policy_version == "2026-10-v1"
    assert consent.granted_at is None

    # Now grant consent
    now = datetime.now(timezone.utc)
    consent.granted = True
    consent.granted_at = now
    await async_test_session.commit()
    await async_test_session.refresh(consent)

    assert consent.granted is True
    assert consent.granted_at is not None


@pytest.mark.asyncio
async def test_meko_datapack_link_server_only(async_test_session: AsyncSession):
    """Verifies meko_datapack_links records server-side mapping correctly."""
    user = User(
        email="meko_user@example.com",
        password_hash="$argon2id$fake",
    )
    async_test_session.add(user)
    await async_test_session.commit()

    profile = PatientProfile(user_id=user.id)
    async_test_session.add(profile)
    await async_test_session.commit()

    link = MekoDatapackLink(
        user_id=user.id,
        patient_profile_id=profile.id,
        datapack_id="dp_pat_test_998877",
        status="active",
    )
    async_test_session.add(link)
    await async_test_session.commit()
    await async_test_session.refresh(link)

    assert link.datapack_id == "dp_pat_test_998877"
    assert link.status == "active"


@pytest.mark.asyncio
async def test_refresh_session_lifecycle(async_test_session: AsyncSession):
    """Verifies refresh token hash storage, expiration, and revocation."""
    user = User(
        email="refresh_test@example.com",
        password_hash="$argon2id$fake",
    )
    async_test_session.add(user)
    await async_test_session.commit()

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=7)
    session = RefreshSession(
        user_id=user.id,
        token_hash="a"*64,
        expires_at=expires,
    )
    async_test_session.add(session)
    await async_test_session.commit()
    await async_test_session.refresh(session)

    assert session.token_hash == "a"*64
    assert session.revoked_at is None

    # Revoke session
    session.revoked_at = datetime.now(timezone.utc)
    await async_test_session.commit()
    await async_test_session.refresh(session)

    assert session.revoked_at is not None


@pytest.mark.asyncio
async def test_duplicate_email_rejected(async_test_session: AsyncSession):
    """Verifies unique email constraint rejects duplicates."""
    u1 = User(email="duplicate@example.com", password_hash="$argon2id$1")
    async_test_session.add(u1)
    await async_test_session.commit()

    u2 = User(email="duplicate@example.com", password_hash="$argon2id$2")
    async_test_session.add(u2)
    with pytest.raises(IntegrityError):
        await async_test_session.commit()
    await async_test_session.rollback()


def test_privacy_boundary_no_medical_fields():
    """
    STRICT PRIVACY AUDIT: Verify that NO medical, prescription, or clinical fields
    exist in users, patient_profiles, privacy_consents, or meko_datapack_links models.
    """
    forbidden_terms = {
        "prescription",
        "medication",
        "diagnosis",
        "condition",
        "symptom",
        "dosage",
        "doctor",
        "hospital",
        "blood",
        "allergy",
        "history",
        "report",
        "document",
        "image",
        "pdf",
        "raw_record",
        "file_blob",
        "file_data",
        "file_path",
    }

    user_cols = {col.name.lower() for col in User.__table__.columns}
    profile_cols = {col.name.lower() for col in PatientProfile.__table__.columns}
    consent_cols = {col.name.lower() for col in PrivacyConsent.__table__.columns}
    meko_cols = {col.name.lower() for col in MekoDatapackLink.__table__.columns}

    for col in user_cols:
        for term in forbidden_terms:
            assert term not in col, f"Forbidden medical term '{term}' found in User table column '{col}'"

    for col in profile_cols:
        for term in forbidden_terms:
            assert term not in col, f"Forbidden medical term '{term}' found in PatientProfile column '{col}'"

    for col in consent_cols:
        for term in forbidden_terms:
            assert term not in col, f"Forbidden medical term '{term}' found in PrivacyConsent column '{col}'"

    for col in meko_cols:
        for term in forbidden_terms:
            assert term not in col, f"Forbidden medical term '{term}' found in MekoDatapackLink column '{col}'"
