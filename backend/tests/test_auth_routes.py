import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def test_app_client():
    """Sets up an isolated test SQLite DB, overrides get_db, and yields an AsyncClient."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_signup_successful(test_app_client: AsyncClient):
    """Verifies user registration, profile provisioning, and auth response."""
    payload = {
        "email": "Patient.One@Example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "display_label": "Patient Alpha",
        "preferred_language": "en",
    }
    res = await test_app_client.post("/api/auth/signup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "patient.one@example.com"
    assert data["profile"]["display_label"] == "Patient Alpha"
    assert data["profile"]["preferred_language"] == "en"

    # Verify refresh token cookie
    cookies = res.cookies
    assert "medeasy_refresh_token" in cookies


@pytest.mark.asyncio
async def test_signup_mismatched_passwords(test_app_client: AsyncClient):
    """Rejects registration when password and confirm_password differ."""
    payload = {
        "email": "mismatch@example.com",
        "password": "Password123!",
        "confirm_password": "DifferentPassword456!",
    }
    res = await test_app_client.post("/api/auth/signup", json=payload)
    assert res.status_code == 422
    assert "Passwords do not match" in res.json()["detail"]


@pytest.mark.asyncio
async def test_signup_duplicate_email_rejected(test_app_client: AsyncClient):
    """Rejects duplicate registration with 409 Conflict."""
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    res1 = await test_app_client.post("/api/auth/signup", json=payload)
    assert res1.status_code == 201

    res2 = await test_app_client.post("/api/auth/signup", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_login_successful_and_wrong_password(test_app_client: AsyncClient):
    """Verifies valid login and generic failure on wrong credentials."""
    # 1. Sign up
    await test_app_client.post(
        "/api/auth/signup",
        json={"email": "login_test@example.com", "password": "CorrectPassword123!"},
    )

    # 2. Login with correct password
    login_res = await test_app_client.post(
        "/api/auth/login",
        json={"email": "login_test@example.com", "password": "CorrectPassword123!"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 3. Login with wrong password
    bad_res = await test_app_client.post(
        "/api/auth/login",
        json={"email": "login_test@example.com", "password": "WrongPassword999!"},
    )
    assert bad_res.status_code == 401
    assert bad_res.json()["detail"] == "Invalid email or password"

    # 4. Login with non-existent email
    ghost_res = await test_app_client.post(
        "/api/auth/login",
        json={"email": "ghost@example.com", "password": "AnyPassword123!"},
    )
    assert ghost_res.status_code == 401
    assert ghost_res.json()["detail"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_protected_routes_require_auth(test_app_client: AsyncClient):
    """Verifies that protected routes reject unauthenticated requests."""
    res_me = await test_app_client.get("/api/auth/me")
    assert res_me.status_code == 401

    res_profile = await test_app_client.get("/api/profile")
    assert res_profile.status_code == 401

    res_consent = await test_app_client.get("/api/privacy/consent")
    assert res_consent.status_code == 401


@pytest.mark.asyncio
async def test_profile_update_and_user_isolation(test_app_client: AsyncClient):
    """Verifies profile update and enforces strict cross-user isolation."""
    # User A
    res_a = await test_app_client.post(
        "/api/auth/signup",
        json={"email": "user_a@example.com", "password": "Password123!", "display_label": "User A Original"},
    )
    token_a = res_a.json()["access_token"]

    # User B
    res_b = await test_app_client.post(
        "/api/auth/signup",
        json={"email": "user_b@example.com", "password": "Password123!", "display_label": "User B Original"},
    )
    token_b = res_b.json()["access_token"]

    # User A updates profile
    headers_a = {"Authorization": f"Bearer {token_a}"}
    patch_res = await test_app_client.patch(
        "/api/profile",
        headers=headers_a,
        json={"display_label": "User A Updated", "preferred_language": "hi"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["display_label"] == "User A Updated"
    assert patch_res.json()["preferred_language"] == "hi"

    # Verify User B profile was untouched
    headers_b = {"Authorization": f"Bearer {token_b}"}
    profile_b = await test_app_client.get("/api/profile", headers=headers_b)
    assert profile_b.status_code == 200
    assert profile_b.json()["display_label"] == "User B Original"
    assert profile_b.json()["preferred_language"] == "en"


@pytest.mark.asyncio
async def test_privacy_consent_grant_and_withdrawal(test_app_client: AsyncClient):
    """Verifies explicit Meko privacy consent opt-in and withdrawal flow."""
    res = await test_app_client.post(
        "/api/auth/signup",
        json={"email": "consent_user@example.com", "password": "Password123!"},
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initial consent state: granted is False
    c1 = await test_app_client.get("/api/privacy/consent", headers=headers)
    assert c1.status_code == 200
    assert c1.json()["granted"] is False

    # 2. Grant explicit consent
    c2 = await test_app_client.put(
        "/api/privacy/consent/meko-memory",
        headers=headers,
        json={"granted": True, "policy_version": "2026-10-v1"},
    )
    assert c2.status_code == 200
    assert c2.json()["granted"] is True
    assert c2.json()["granted_at"] is not None

    # 3. Withdraw consent
    c3 = await test_app_client.delete(
        "/api/privacy/consent/meko-memory",
        headers=headers,
    )
    assert c3.status_code == 200
    assert c3.json()["granted"] is False
    assert c3.json()["withdrawn_at"] is not None

    # 4. Verify GET reflects withdrawn state
    c4 = await test_app_client.get("/api/privacy/consent", headers=headers)
    assert c4.status_code == 200
    assert c4.json()["granted"] is False


@pytest.mark.asyncio
async def test_token_refresh_and_logout(test_app_client: AsyncClient):
    """Verifies token rotation on refresh and session revocation on logout."""
    res = await test_app_client.post(
        "/api/auth/signup",
        json={"email": "session_test@example.com", "password": "Password123!"},
    )
    assert res.status_code == 201
    refresh_cookie = res.cookies.get("medeasy_refresh_token")
    assert refresh_cookie is not None

    # Refresh access token
    test_app_client.cookies.set("medeasy_refresh_token", refresh_cookie)
    ref_res = await test_app_client.post("/api/auth/refresh")
    assert ref_res.status_code == 200
    new_access_token = ref_res.json()["access_token"]
    assert new_access_token is not None

    # Logout
    logout_res = await test_app_client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Old refresh token should now fail
    ref_fail = await test_app_client.post("/api/auth/refresh")
    assert ref_fail.status_code == 401
