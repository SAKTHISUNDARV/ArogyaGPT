"""
ArogyaGPT - Core Configuration
Centralized settings management using Pydantic v2 BaseSettings.
All environment variables are validated and typed at startup.
"""

from typing import List, Optional
from pydantic import field_validator, AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All secrets and configurations are managed here.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # --- Application ---
    APP_NAME: str = "ArogyaGPT"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "AI-Powered Multilingual Medical Report Simplification & Health Assistant"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    ALLOWED_HOSTS: List[str] = ["*"]

    # --- CORS ---
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # --- Database (PostgreSQL) ---
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/arogyagpt"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 1800
    DATABASE_ECHO: bool = False

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_TOKEN_BLACKLIST_DB: int = 1
    REDIS_CACHE_DB: int = 2
    REDIS_CELERY_DB: int = 3
    REDIS_TTL_SECONDS: int = 3600

    # --- JWT Authentication ---
    SECRET_KEY: str = "CHANGE-THIS-TO-A-STRONG-RANDOM-SECRET-KEY-IN-PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1

    # --- Google OAuth ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://127.0.0.1:8000/api/v1/auth/google/callback"
    GOOGLE_OAUTH_FRONTEND_URL: str = "http://127.0.0.1:5173/"

    # --- Password Policy ---
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_MAX_LENGTH: int = 128

    # --- Rate Limiting ---
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10

    # --- Celery ---
    CELERY_BROKER_URL: str = "redis://localhost:6379/3"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/3"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "Asia/Kolkata"

    # --- AI / Groq LLM ---
    GROQ_API_KEY: str = ""
    GROQ_MODEL_NAME: str = "qwen/qwen3.8-27b"
    GROQ_MAX_TOKENS: int = 4096
    GROQ_TEMPERATURE: float = 0.1

    # --- OpenAI (Fallback) ---
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_NAME: str = "gpt-4o"

    # --- Embeddings ---
    HUGGINGFACE_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cpu"
    EMBEDDING_BATCH_SIZE: int = 32

    # --- FAISS Vector Store ---
    FAISS_INDEX_PATH: str = "./data/faiss_index"
    FAISS_INDEX_DIMENSION: int = 384
    RAG_CHUNK_SIZE: int = 512
    RAG_CHUNK_OVERLAP: int = 64
    RAG_TOP_K: int = 5

    # --- NLP / spaCy ---
    SPACY_MODEL: str = "en_core_web_sm"

    # --- OCR ---
    TESSERACT_CMD: str = "tesseract"
    OCR_PROVIDER: str = "tesseract"  # tesseract | paddleocr
    OCR_LANGUAGE: str = "eng"
    MAX_UPLOAD_SIZE_MB: int = 20

    # --- File Upload ---
    UPLOAD_DIR: str = "./data/uploads"
    ALLOWED_FILE_TYPES: List[str] = ["pdf", "png", "jpg", "jpeg"]
    MAX_FILE_SIZE_BYTES: int = 20 * 1024 * 1024  # 20 MB

    # --- AWS S3 Storage ---
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str = ""
    USE_S3: bool = False

    # --- Google Translate ---
    GOOGLE_TRANSLATE_API_KEY: str = ""
    USE_GOOGLE_TRANSLATE: bool = False

    # --- Text-to-Speech ---
    TTS_PROVIDER: str = "gtts"  # gtts | azure | google
    TTS_OUTPUT_DIR: str = "./data/audio"
    AZURE_TTS_KEY: str = ""
    AZURE_TTS_REGION: str = ""

    # --- Email (SMTP) ---
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@arogyagpt.com"
    SMTP_TLS: bool = True
    EMAIL_ENABLED: bool = True

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "./logs/arogyagpt.log"
    LOG_ROTATION: str = "10 MB"
    LOG_RETENTION: str = "30 days"
    LOG_JSON_FORMAT: bool = False

    # --- Admin ---
    FIRST_ADMIN_EMAIL: str = "admin@arogyagpt.com"
    FIRST_ADMIN_PASSWORD: str = "Admin@12345"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def validate_debug(cls, v):
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "t", "dev", "debug")
        return bool(v)

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {allowed}")
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def database_url_sync(self) -> str:
        """Synchronous database URL for Alembic migrations."""
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


# Singleton settings instance
settings = Settings()
