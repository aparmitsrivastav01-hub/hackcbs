import os
import ssl
from pathlib import Path
from typing import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

BASE_DIR = Path(__file__).resolve().parents[2]


class Base(DeclarativeBase):
    pass


def normalize_database_url(url: str | None) -> tuple[str, dict]:
    """
    Normalizes database URL to async SQLAlchemy format and configures driver connect_args
    (including TLS/SSL and statement caching for YugabyteDB Aeon).
    """
    connect_args = {}

    if not url:
        default_db = BASE_DIR / "medeasy_accounts.db"
        return f"sqlite+aiosqlite:///{default_db}", connect_args

    clean_raw = "".join(url.splitlines()).strip()
    parsed = urlparse(clean_raw)
    scheme = parsed.scheme.lower()
    query_params = parse_qs(parsed.query)

    # Convert sync postgresql schemes to asyncpg
    if scheme in ("postgresql", "postgres"):
        new_scheme = "postgresql+asyncpg"
    elif scheme in ("postgresql+asyncpg", "sqlite+aiosqlite"):
        new_scheme = scheme
    else:
        new_scheme = scheme

    # Clean out parameters that asyncpg handles via connect_args or SSLContext
    sslmode = query_params.pop("sslmode", [None])[0]
    query_params.pop("ssl", None)
    query_params.pop("sslrootcert", None)

    hostname = (parsed.hostname or "").lower()
    is_yugabyte = "yugabyte" in hostname

    # Configure SSL
    if sslmode or is_yugabyte:
        ssl_ctx = ssl.create_default_context()
        if sslmode in ("disable", "allow"):
            connect_args["ssl"] = False
        else:
            # Cloud YugabyteDB cluster verification
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ssl_ctx

    if is_yugabyte:
        # Crucial for YugabyteDB: disable asyncpg client statement caching
        # across distributed tablet servers
        connect_args["statement_cache_size"] = 0

    # Ensure database path is present (YugabyteDB default is 'yugabyte')
    path = parsed.path
    if not path or path == "/":
        path = "/yugabyte" if is_yugabyte else "/postgres"

    new_query = urlencode(query_params, doseq=True)
    clean_url = urlunparse((new_scheme, parsed.netloc, path, parsed.params, new_query, parsed.fragment))

    return clean_url, connect_args


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_async_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        raw_url = os.getenv("DATABASE_URL")
        db_url, connect_args = normalize_database_url(raw_url)

        is_sqlite = db_url.startswith("sqlite")
        engine_kwargs = {
            "echo": False,
            "future": True,
        }

        if is_sqlite:
            engine_kwargs["connect_args"] = {"check_same_thread": False}
        else:
            engine_kwargs["pool_size"] = 10
            engine_kwargs["max_overflow"] = 20
            engine_kwargs["pool_pre_ping"] = True
            engine_kwargs["pool_recycle"] = 1800
            if connect_args:
                engine_kwargs["connect_args"] = connect_args

        _engine = create_async_engine(db_url, **engine_kwargs)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        engine = get_async_engine()
        _session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for obtaining an async database session with automatic rollback on error."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            try:
                await session.commit()
            except Exception:
                await session.rollback()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_health() -> dict[str, str | bool]:
    """Executes a lightweight query to verify database connectivity."""
    from sqlalchemy import text
    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            await session.execute(text("SELECT 1"))
        return {"connected": True, "status": "healthy"}
    except Exception as exc:
        return {"connected": False, "status": "unhealthy", "error": str(exc)}
