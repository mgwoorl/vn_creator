"""
Асинхронная настройка подключения к базе данных PostgreSQL.
Использует asyncpg для асинхронной работы с БД.
"""
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker
)
from sqlalchemy.orm import declarative_base

from src.config import config

# Создаем асинхронный движок с пулом соединений
engine = create_async_engine(
    config.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=config.debug
)

# Фабрика асинхронных сессий
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Базовый класс для моделей
Base = declarative_base()
BaseDBModel = Base


async def get_db():
    """
    Асинхронный генератор сессий базы данных.
    Используется как зависимость в FastAPI эндпоинтах.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Инициализация базы данных - создание всех таблиц."""
    async with engine.begin() as conn:
        await conn.run_sync(BaseDBModel.metadata.create_all)


async def close_db():
    """Закрытие всех соединений с базой данных."""
    await engine.dispose()