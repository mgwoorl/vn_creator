"""
Асинхронные CRUD операции для работы с пользователями.
С Redis для управления сессиями.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Response

from src.config import config
from src.redis_client import (
    save_refresh_token,
    get_refresh_token,
    delete_refresh_token,
    delete_all_user_tokens,
    get_user_sessions
)
from src.users import models, schemas
from src.users.exceptions import (
    UserNotFoundError, UserPermissionError,
    UserValidationError, EmailAlreadyExistsError,
    InvalidRoleError
)
from src.logger import setup_logger

logger = setup_logger(__name__, 'users.log')

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

logger.info(
    "Модуль пользователей инициализирован "
    f"(access токен: {config.access_token_expire_minutes} мин, "
    f"refresh токен: {config.refresh_token_expire_days} дней)"
)


def get_password_hash(password: str) -> str:
    """Хеширует пароль."""
    if not password:
        logger.error("Попытка хеширования пустого пароля")
        raise UserValidationError("Пароль не может быть пустым")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль."""
    if not plain_password or not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """Создает access токен (JWT, короткоживущий)."""
    to_encode = data.copy()
    to_encode.update({
        "exp": datetime.utcnow() + timedelta(minutes=config.access_token_expire_minutes),
        "type": "access"
    })
    return jwt.encode(to_encode, config.secret_key, algorithm=config.algorithm)


def create_refresh_token_value() -> str:
    """Создает refresh токен (случайная строка, не JWT)."""
    return str(uuid.uuid4()) + str(uuid.uuid4()).replace('-', '')


def decode_access_token(token: str) -> Optional[dict]:
    """Декодирует access токен."""
    try:
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def set_token_cookies(response: Response, access_token: str, refresh_token: str):
    """Устанавливает токены в cookies."""
    is_production = config.env == "production"
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=config.access_token_expire_minutes * 60,
        path="/"
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=config.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/users/refresh"
    )


def clear_token_cookies(response: Response):
    """Удаляет токены из cookies."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/users/refresh")


# Сессии через Redis

async def create_session(
    user_id: int,
    response: Response,
    device_info: str = "unknown",
    ip_address: str = "unknown"
) -> str:
    """Создает новую сессию: JWT access + refresh в Redis."""
    access_token = create_access_token({"user_id": user_id})
    refresh_token = create_refresh_token_value()
    
    await save_refresh_token(user_id, refresh_token, device_info, ip_address)
    set_token_cookies(response, access_token, refresh_token)
    
    return access_token


async def refresh_session(
    old_refresh_token: str,
    response: Response,
    device_info: str = "unknown",
    ip_address: str = "unknown"
) -> Optional[str]:
    """Обновляет сессию с ротацией refresh токена."""
    session = await get_refresh_token(old_refresh_token)
    if not session:
        return None
    
    user_id = session["user_id"]
    await delete_refresh_token(old_refresh_token)
    return await create_session(user_id, response, device_info, ip_address)


async def terminate_session(refresh_token: str):
    """Завершает конкретную сессию."""
    await delete_refresh_token(refresh_token)


async def terminate_all_sessions(user_id: int):
    """Завершает все сессии пользователя."""
    await delete_all_user_tokens(user_id)


async def get_active_sessions(user_id: int) -> List[Dict]:
    """Возвращает активные сессии."""
    return await get_user_sessions(user_id)


# CRUD операции

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[models.User]:
    if not email:
        return None
    query = await db.execute(select(models.User).where(models.User.email == email))
    return query.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[models.User]:
    if not user_id:
        return None
    query = await db.execute(select(models.User).where(models.User.id == user_id))
    return query.scalar_one_or_none()


async def get_all_users(db: AsyncSession) -> List[models.User]:
    query = await db.execute(select(models.User).order_by(models.User.created_at.desc()))
    return query.scalars().all()


async def get_all_groups(db: AsyncSession) -> List[models.Group]:
    query = await db.execute(select(models.Group).order_by(models.Group.name))
    return query.scalars().all()


async def get_group_by_id(db: AsyncSession, group_id: int) -> Optional[models.Group]:
    if not group_id:
        return None
    query = await db.execute(select(models.Group).where(models.Group.id == group_id))
    return query.scalar_one_or_none()


async def create_user(db: AsyncSession, user_data, is_active: bool = False) -> models.User:
    email = user_data.email
    password = user_data.password
    last_name = user_data.last_name
    first_name = user_data.first_name
    patronymic = getattr(user_data, 'patronymic', '') or ""
    role = getattr(user_data, 'role', 'student')
    group_id = getattr(user_data, 'group_id', None)

    if not email or not password:
        raise UserValidationError("Email и пароль обязательны")

    existing = await get_user_by_email(db, email)
    if existing:
        raise EmailAlreadyExistsError()

    if len(password) < 4:
        raise UserValidationError("Пароль должен быть не менее 4 символов")

    if role not in ["student", "teacher", "admin", "super_admin"]:
        raise InvalidRoleError()

    hashed_password = get_password_hash(password)

    db_user = models.User(
        email=email,
        last_name=last_name,
        first_name=first_name,
        patronymic=patronymic,
        password=hashed_password,
        role=role,
        group_id=group_id if role == "student" else None,
        is_active=is_active
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    await assign_starter_status(db, db_user.id)
    return db_user


async def assign_starter_status(db: AsyncSession, user_id: int):
    status_query = await db.execute(select(models.Status).where(models.Status.name == "Стажёр"))
    starter_status = status_query.scalar_one_or_none()
    
    if not starter_status:
        starter_status = models.Status(name="Стажёр")
        db.add(starter_status)
        await db.commit()
        await db.refresh(starter_status)

    existing_query = await db.execute(
        select(models.UserStatus).where(
            models.UserStatus.user_id == user_id,
            models.UserStatus.status_id == starter_status.id
        )
    )
    if not existing_query.scalar_one_or_none():
        db.add(models.UserStatus(user_id=user_id, status_id=starter_status.id))
        await db.commit()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[models.User]:
    if not email or not password:
        return None

    user = await get_user_by_email(db, email)
    if not user:
        return None

    if not verify_password(password, user.password):
        return None

    if not user.is_active:
        return user

    return user


async def update_user(db: AsyncSession, user_id: int, user_update: dict) -> Optional[models.User]:
    db_user = await get_user_by_id(db, user_id)
    if not db_user:
        raise UserNotFoundError()

    if 'email' in user_update and user_update['email'] != db_user.email:
        existing = await get_user_by_email(db, user_update['email'])
        if existing and existing.id != user_id:
            raise EmailAlreadyExistsError()

    password_changed = False
    for field, value in user_update.items():
        if field == 'password':
            if not value or len(str(value)) < 4:
                raise UserValidationError("Пароль должен быть не менее 4 символов")
            db_user.password = get_password_hash(str(value))
            password_changed = True
        elif hasattr(db_user, field):
            setattr(db_user, field, value)

    db_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_user)
    
    if password_changed:
        await terminate_all_sessions(user_id)
    
    return db_user


async def update_user_password(db: AsyncSession, user_id: int, new_password: str) -> Optional[models.User]:
    if not new_password or len(new_password) < 4:
        raise UserValidationError("Пароль должен быть не менее 4 символов")

    db_user = await get_user_by_id(db, user_id)
    if not db_user:
        raise UserNotFoundError()

    db_user.password = get_password_hash(new_password)
    db_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_user)
    
    await terminate_all_sessions(user_id)
    return db_user


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    db_user = await get_user_by_id(db, user_id)
    if not db_user:
        raise UserNotFoundError()

    if db_user.role == "super_admin":
        raise UserPermissionError("Нельзя удалить супер-админа")

    await db.delete(db_user)
    await db.commit()
    await terminate_all_sessions(user_id)
    return True


async def create_group(db: AsyncSession, name: str) -> models.Group:
    if not name or not name.strip():
        raise UserValidationError("Название группы обязательно")

    existing_query = await db.execute(select(models.Group).where(models.Group.name == name.strip()))
    if existing_query.scalar_one_or_none():
        raise UserValidationError("Группа с таким названием уже существует")

    group = models.Group(name=name.strip())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


async def update_group(db: AsyncSession, group_id: int, name: str) -> Optional[models.Group]:
    group = await get_group_by_id(db, group_id)
    if not group:
        raise UserNotFoundError("Группа не найдена")

    if name and name.strip():
        existing_query = await db.execute(
            select(models.Group).where(models.Group.name == name.strip(), models.Group.id != group_id)
        )
        if existing_query.scalar_one_or_none():
            raise UserValidationError("Группа с таким названием уже существует")
        group.name = name.strip()

    await db.commit()
    await db.refresh(group)
    return group


async def delete_group(db: AsyncSession, group_id: int) -> bool:
    group = await get_group_by_id(db, group_id)
    if not group:
        raise UserNotFoundError("Группа не найдена")
    await db.delete(group)
    await db.commit()
    return True


async def is_super_admin_exists(db: AsyncSession) -> bool:
    query = await db.execute(select(models.User).where(models.User.role == "super_admin"))
    return query.scalar_one_or_none() is not None


async def get_user_statuses(db: AsyncSession, user_id: int) -> List[dict]:
    user_statuses_query = await db.execute(
        select(models.UserStatus).where(models.UserStatus.user_id == user_id).order_by(models.UserStatus.earned_at.desc())
    )
    user_statuses = user_statuses_query.scalars().all()

    result_list = []
    for us in user_statuses:
        status_query = await db.execute(select(models.Status).where(models.Status.id == us.status_id))
        status = status_query.scalar_one_or_none()
        
        if status:
            project_title = None
            if us.playthrough_id:
                from src.playthroughs.models import Playthrough
                from src.projects.models import Project

                playthrough_query = await db.execute(select(Playthrough).where(Playthrough.id == us.playthrough_id))
                playthrough = playthrough_query.scalar_one_or_none()
                
                if playthrough:
                    project_query = await db.execute(select(Project).where(Project.id == playthrough.project_id))
                    project = project_query.scalar_one_or_none()
                    if project:
                        project_title = project.title

            result_list.append({
                "name": status.name,
                "earned_at": us.earned_at,
                "playthrough_id": us.playthrough_id,
                "project_title": project_title
            })

    return result_list


async def toggle_user_active(db: AsyncSession, user_id: int, is_active: bool) -> Optional[models.User]:
    db_user = await get_user_by_id(db, user_id)
    if not db_user:
        raise UserNotFoundError()

    db_user.is_active = is_active
    db_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_user)
    
    if not is_active:
        await terminate_all_sessions(user_id)
    
    return db_user