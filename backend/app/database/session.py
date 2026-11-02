"""
ArogyaGPT - Database Session Manager
Async SQLAlchemy 2.0 engine, session factory, and dependency injection.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    """
    SQLAlchemy declarative base for all ORM models.
    All models must inherit from this class.
    """
    pass


# --- Async Engine ---
engine_kwargs = {
    "echo": settings.DATABASE_ECHO,
}
if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": settings.DATABASE_POOL_SIZE,
        "max_overflow": settings.DATABASE_MAX_OVERFLOW,
        "pool_timeout": settings.DATABASE_POOL_TIMEOUT,
        "pool_recycle": settings.DATABASE_POOL_RECYCLE,
        "pool_pre_ping": True,
    })
else:
    engine_kwargs.update({
        "connect_args": {"timeout": 60}
    })

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

# --- Async Session Factory ---
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session per request.
    Ensures the session is properly closed after each request.

    Yields:
        AsyncSession: An active database session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database by creating all tables.
    Should be called once on application startup.
    Use Alembic for production migrations.
    """
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        # Import all models to register them with Base
        from app.models import (  # noqa: F401
            user,
            refresh_token,
            report,
            chat,
            translation,
            voice,
            audit,
        )
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized successfully.")


async def close_db() -> None:
    """Dispose the database engine connection pool on shutdown."""
    await engine.dispose()
    logger.info("Database connection pool closed.")
