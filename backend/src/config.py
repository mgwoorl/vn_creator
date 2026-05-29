"""
Конфигурация приложения Visual Novel Builder.
"""
import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Основная конфигурация приложения."""
    
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", "8000"))
    app_reload: bool = os.getenv("APP_RELOAD", "true").lower() == "true"
    
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://vn_builder:1234@localhost:5432/visual_novel_db2"
    )
    
    # Redis
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    redis_password: str = os.getenv("REDIS_PASSWORD", "")
    redis_url: str = os.getenv(
        "REDIS_URL",
        f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}" if redis_password else f"redis://{redis_host}:{redis_port}/{redis_db}"
    )
    
    # JWT
    secret_key: str = os.getenv("SECRET_KEY", "default-secret-key-change-in-production")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # CORS
    allow_origins: List[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173"
    ).split(",")
    
    # Super admin
    super_admin_email: str = os.getenv("SUPER_ADMIN_EMAIL", "admin@example.com")
    super_admin_password: str = os.getenv("SUPER_ADMIN_PASSWORD", "admin123")
    super_admin_first_name: str = os.getenv("SUPER_ADMIN_FIRST_NAME", "Super")
    super_admin_last_name: str = os.getenv("SUPER_ADMIN_LAST_NAME", "Admin")
    
    # App
    env: str = os.getenv("ENV", "development")
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # S3
    s3_access_key: str = os.getenv("S3_ACCESS_KEY", "")
    s3_secret_key: str = os.getenv("S3_SECRET_KEY", "")
    s3_bucket_name: str = os.getenv("S3_BUCKET_NAME", "visual-novel-files")


config = Config()