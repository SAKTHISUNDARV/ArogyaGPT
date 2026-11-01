"""
ArogyaGPT - Authentication Service
Complete business logic for user registration, login, token management,
password reset, and email verification.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from jose import JWTError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import APIMessage, CacheTTL
from app.core.exceptions import (
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    TokenExpiredError,
    TokenInvalidError,
    TokenBlacklistedError,
    UserNotFoundError,
    AuthenticationError,
    WeakPasswordError,
    EmailNotVerifiedError,
)
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_token,
    get_token_jti,
    get_token_expiry,
    hash_password,
    verify_password,
)
from app.cache.redis_manager import RedisManager
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

logger = get_logger(__name__)


def _hash_token(token: str) -> str:
    """SHA-256 hash a refresh token for safe database storage."""
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    """
    Authentication service implementing all auth business logic.
    Stateless — all state lives in DB and Redis.
    """

    def __init__(self, db: AsyncSession, redis: RedisManager) -> None:
        self.db = db
        self.redis = redis

    # =========================================================================
    # Registration
    # =========================================================================

    async def register(
        self,
        data: RegisterRequest,
        ip_address: Optional[str] = None,
    ) -> User:
        """
        Register a new user account.

        Steps:
        1. Check email uniqueness.
        2. Hash password.
        3. Create user record.
        4. Send verification email (if email service enabled).

        Raises:
            EmailAlreadyExistsError: If email is already registered.
        """
        # Check for duplicate email
        existing = await self.db.execute(
            select(User).where(User.email == data.email.lower())
        )
        if existing.scalar_one_or_none():
            raise EmailAlreadyExistsError()

        # Create user
        raw_role = data.role.value if hasattr(data.role, "value") else str(data.role)
        user = User(
            id=str(uuid.uuid4()),
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name.strip(),
            role=raw_role,
            preferred_language=data.preferred_language,
            phone_number=data.phone_number,
            gender=data.gender,
            is_active=True,
            is_email_verified=not settings.EMAIL_ENABLED,
        )
        self.db.add(user)
        await self.db.flush()  # Get the ID without committing

        logger.info(f"New user registered: {user.email} (role={user.role}, id={user.id})")

        # TODO (email enabled): Send verification email via Celery worker
        # from app.workers.tasks import send_verification_email_task
        # send_verification_email_task.delay(user.id, user.email)

        return user

    # =========================================================================
    # Login
    # =========================================================================

    async def login(
        self,
        data: LoginRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[User, TokenResponse]:
        """
        Authenticate user and issue JWT token pair.

        Steps:
        1. Look up user by email.
        2. Verify password.
        3. Check account status.
        4. Issue access + refresh tokens.
        5. Store refresh token in DB.
        6. Update last_login_at.

        Returns:
            Tuple of (User, TokenResponse).

        Raises:
            InvalidCredentialsError: Wrong email or password.
            AuthenticationError: Account deactivated or locked.
            EmailNotVerifiedError: Email not yet verified.
        """
        # Find user by email
        result = await self.db.execute(
            select(User).where(User.email == data.email.lower(), User.is_deleted == False)
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"Login attempt for non-existent email: {data.email}")
            raise InvalidCredentialsError()

        # Check account lock
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise AuthenticationError(
                f"Account is temporarily locked. Try again after {user.locked_until.strftime('%H:%M UTC')}."
            )

        # Verify password
        if not verify_password(data.password, user.hashed_password):
            # Increment failure counter
            await self.db.execute(
                update(User)
                .where(User.id == user.id)
                .values(failed_login_attempts=User.failed_login_attempts + 1)
            )
            logger.warning(f"Failed login attempt for user: {user.email}")
            raise InvalidCredentialsError()

        # Check active status
        if not user.is_active:
            raise AuthenticationError("Account is deactivated. Please contact support.")

        # Email verification check
        if settings.EMAIL_ENABLED and not user.is_email_verified:
            raise EmailNotVerifiedError()

        # Reset failed attempts & update last login
        await self.db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                failed_login_attempts=0,
                locked_until=None,
                last_login_at=datetime.now(timezone.utc),
            )
        )

        # Issue tokens
        access_token = create_access_token(subject=user.id, role=user.role)
        refresh_token = create_refresh_token(subject=user.id)

        # Store hashed refresh token in DB
        await self._store_refresh_token(
            user_id=user.id,
            refresh_token=refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(f"User logged in successfully: {user.email} (id={user.id})")

        token_response = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        return user, token_response

    async def google_login(
        self,
        email: str,
        full_name: str,
        avatar_url: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[User, TokenResponse]:
        """Find or create a verified user from an OAuth profile."""
        normalized_email = email.lower().strip()
        result = await self.db.execute(
            select(User).where(
                User.email == normalized_email,
                User.is_deleted == False,
            )
        )
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                id=str(uuid.uuid4()),
                email=normalized_email,
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                full_name=full_name.strip() or normalized_email.split("@")[0],
                role="patient",
                preferred_language="en",
                avatar_url=avatar_url,
                is_active=True,
                is_email_verified=True,
            )
            self.db.add(user)
            await self.db.flush()
        else:
            if not user.is_active:
                raise AuthenticationError("Your account has been deactivated. Contact support.")
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            if not user.is_email_verified:
                user.is_email_verified = True

        await self.db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                failed_login_attempts=0,
                locked_until=None,
                last_login_at=datetime.now(timezone.utc),
            )
        )

        access_token = create_access_token(subject=user.id, role=user.role)
        refresh_token = create_refresh_token(subject=user.id)
        await self._store_refresh_token(
            user_id=user.id,
            refresh_token=refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        token_response = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        return user, token_response

    # =========================================================================
    # Token Refresh
    # =========================================================================

    async def refresh_tokens(
        self,
        refresh_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> TokenResponse:
        """
        Rotate refresh token and issue new access token.

        Implements refresh token rotation:
        - Old refresh token is revoked.
        - New refresh token is issued and stored.

        Raises:
            TokenInvalidError: If refresh token is invalid.
            TokenExpiredError: If refresh token has expired.
            TokenBlacklistedError: If refresh token is already revoked.
        """
        try:
            payload = decode_token(refresh_token)
        except JWTError as e:
            if "expired" in str(e).lower():
                raise TokenExpiredError()
            raise TokenInvalidError()

        if payload.get("type") != "refresh":
            raise TokenInvalidError()

        user_id = payload.get("sub")
        if not user_id:
            raise TokenInvalidError()

        # Verify refresh token in DB
        token_hash = _hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,
            )
        )
        stored_token = result.scalar_one_or_none()

        if not stored_token:
            logger.warning(f"Refresh token reuse detected for user_id={user_id}")
            raise TokenBlacklistedError()

        # Check expiry
        if stored_token.expires_at < datetime.now(timezone.utc):
            raise TokenExpiredError()

        # Revoke old token (rotation)
        stored_token.is_revoked = True
        stored_token.revoked_at = datetime.now(timezone.utc)

        # Load user
        user_result = await self.db.execute(
            select(User).where(User.id == user_id, User.is_active == True, User.is_deleted == False)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise AuthenticationError("User account not found.")

        # Issue new token pair
        new_access_token = create_access_token(subject=user.id, role=user.role)
        new_refresh_token = create_refresh_token(subject=user.id)

        await self._store_refresh_token(
            user_id=user.id,
            refresh_token=new_refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(f"Tokens refreshed for user_id={user.id}")

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    # =========================================================================
    # Logout
    # =========================================================================

    async def logout(
        self,
        user: User,
        access_token: str,
        refresh_token: Optional[str] = None,
    ) -> None:
        """
        Logout user by blacklisting JWT access token and revoking refresh token.

        Args:
            user: The authenticated user.
            access_token: The current access token (to blacklist in Redis).
            refresh_token: Optional refresh token (to revoke in DB).
        """
        # Blacklist the access token JTI in Redis
        jti = get_token_jti(access_token)
        expiry = get_token_expiry(access_token)
        if jti and expiry:
            remaining_seconds = int(
                (expiry - datetime.now(timezone.utc)).total_seconds()
            )
            if remaining_seconds > 0:
                await self.redis.blacklist_token(jti, remaining_seconds)

        # Revoke refresh token in DB
        if refresh_token:
            token_hash = _hash_token(refresh_token)
            result = await self.db.execute(
                select(RefreshToken).where(
                    RefreshToken.token_hash == token_hash,
                    RefreshToken.user_id == user.id,
                    RefreshToken.is_revoked == False,
                )
            )
            stored = result.scalar_one_or_none()
            if stored:
                stored.is_revoked = True
                stored.revoked_at = datetime.now(timezone.utc)

        # Invalidate user profile cache
        await self.redis.delete(RedisManager.user_profile_key(user.id))

        logger.info(f"User logged out: {user.email} (id={user.id})")

    # =========================================================================
    # Email Verification
    # =========================================================================

    async def send_verification_email(self, email: str) -> None:
        """
        Generate and send an email verification token.

        In production, this dispatches a Celery task to send the email.
        The token is generated and logged here; actual email sending is async.
        """
        result = await self.db.execute(
            select(User).where(User.email == email.lower(), User.is_deleted == False)
        )
        user = result.scalar_one_or_none()

        if not user:
            # Do NOT reveal if user exists (security best practice)
            logger.info(f"Verification email requested for non-existent email: {email}")
            return

        if user.is_email_verified:
            logger.info(f"Email already verified for user: {email}")
            return

        token = create_email_verification_token(subject=user.id)
        logger.info(
            f"Email verification token generated for {email}. "
            f"Token (share securely): {token[:20]}..."
        )
        # In production: from app.workers.tasks import send_verification_email_task
        # send_verification_email_task.delay(user.id, user.email, token)

    async def verify_email(self, token: str) -> User:
        """
        Verify email address using the token from the verification link.

        Raises:
            TokenInvalidError: If token is bad.
            TokenExpiredError: If token has expired.
            AuthenticationError: If user not found.
        """
        try:
            payload = decode_token(token)
        except JWTError as e:
            if "expired" in str(e).lower():
                raise TokenExpiredError()
            raise TokenInvalidError()

        if payload.get("type") != "email_verify":
            raise TokenInvalidError()

        user_id = payload.get("sub")
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.is_deleted == False)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise AuthenticationError("User not found.")

        if user.is_email_verified:
            logger.info(f"Email already verified: {user.email}")
            return user

        user.is_email_verified = True
        logger.info(f"Email verified successfully: {user.email}")
        return user

    # =========================================================================
    # Password Management
    # =========================================================================

    async def change_password(
        self, user: User, data: ChangePasswordRequest
    ) -> None:
        """
        Change password for an authenticated user.

        Raises:
            InvalidCredentialsError: If current password is wrong.
        """
        if not verify_password(data.current_password, user.hashed_password):
            raise InvalidCredentialsError()

        user.hashed_password = hash_password(data.new_password)

        # Revoke all existing refresh tokens (force re-login on other devices)
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)
            .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
        )

        logger.info(f"Password changed for user: {user.email}")

    async def request_password_reset(self, email: str) -> None:
        """
        Initiate password reset flow.
        Always returns success to prevent email enumeration.
        """
        result = await self.db.execute(
            select(User).where(User.email == email.lower(), User.is_deleted == False)
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.info(f"Password reset requested for non-existent email: {email}")
            return  # Fail silently

        token = create_password_reset_token(subject=user.id)
        logger.info(
            f"Password reset token generated for {email}. "
            f"Token (share securely): {token[:20]}..."
        )
        # In production: from app.workers.tasks import send_password_reset_task
        # send_password_reset_task.delay(user.id, user.email, token)

    async def reset_password(self, token: str, new_password: str) -> None:
        """
        Reset password using the token from the reset email.

        Raises:
            TokenInvalidError: If token is invalid.
            TokenExpiredError: If token has expired.
        """
        try:
            payload = decode_token(token)
        except JWTError as e:
            if "expired" in str(e).lower():
                raise TokenExpiredError()
            raise TokenInvalidError()

        if payload.get("type") != "password_reset":
            raise TokenInvalidError()

        user_id = payload.get("sub")
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.is_deleted == False)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise AuthenticationError("User not found.")

        user.hashed_password = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None

        # Revoke all sessions
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)
            .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
        )

        logger.info(f"Password reset completed for user: {user.email}")

    # =========================================================================
    # Private Helpers
    # =========================================================================

    async def _store_refresh_token(
        self,
        user_id: str,
        refresh_token: str,
        ip_address: Optional[str],
        user_agent: Optional[str],
    ) -> None:
        """Store a hashed refresh token in the database."""
        expiry = get_token_expiry(refresh_token)
        token_record = RefreshToken(
            id=str(uuid.uuid4()),
            user_id=user_id,
            token_hash=_hash_token(refresh_token),
            expires_at=expiry or datetime.now(timezone.utc),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(token_record)
        await self.db.flush()
