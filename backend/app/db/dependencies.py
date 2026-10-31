import uuid
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.models.user_models import User
from app.services.auth_service import decode_access_token, get_user_by_id

# Security Bearer scheme (auto_error=False allows optional auth)
http_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    session: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency: Enforces valid authenticated session.
    Extracts Bearer JWT, validates signature/expiry, and fetches active user from YugabyteDB.
    Raises HTTP 401 if token is missing, expired, or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials; please sign in",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not auth or not auth.credentials:
        raise credentials_exception

    payload = decode_access_token(auth.credentials)
    if not payload:
        raise credentials_exception

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    user = await get_user_by_id(session, user_id)
    if not user or not user.is_active:
        raise credentials_exception

    return user


async def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    session: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    FastAPI dependency: Optional user authentication.
    Returns User if valid credentials provided; None otherwise.
    Allows public routes (like catalogue browse) to stay completely functional for unauthenticated users.
    """
    if not auth or not auth.credentials:
        return None

    payload = decode_access_token(auth.credentials)
    if not payload or not payload.get("sub"):
        return None

    try:
        user_id = uuid.UUID(payload["sub"])
        user = await get_user_by_id(session, user_id)
        if user and user.is_active:
            return user
    except Exception:
        pass

    return None
