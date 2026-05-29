"""
Асинхронный клиент Redis для управления сессиями и кэшированием.
"""
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import redis.asyncio as redis

from src.config import config
from src.logger import setup_logger

logger = setup_logger(__name__, 'redis.log')

# Создаем пул соединений
redis_pool = redis.ConnectionPool.from_url(
    config.redis_url,
    max_connections=20,
    decode_responses=True
)

redis_client = redis.Redis(connection_pool=redis_pool)


async def init_redis():
    """Проверка подключения к Redis."""
    try:
        await redis_client.ping()
        logger.info("Redis connected successfully")
        return True
    except Exception as e:
        logger.warning(f"Redis unavailable: {e}. Running without session management.")
        return False


async def close_redis():
    """Закрытие соединения."""
    try:
        await redis_client.close()
        await redis_pool.disconnect()
    except Exception:
        pass


# Управление refresh токенами (сессиями)

async def save_refresh_token(
    user_id: int,
    token: str,
    device_info: str = "unknown",
    ip_address: str = "unknown"
):
    """
    Сохраняет refresh токен в Redis.
    Ключ: refresh:{token}
    Значение: информация о сессии
    TTL: время жизни refresh токена
    """
    session_data = {
        "user_id": user_id,
        "device": device_info,
        "ip": ip_address,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(days=config.refresh_token_expire_days)).isoformat()
    }
    
    ttl = config.refresh_token_expire_days * 24 * 60 * 60
    
    await redis_client.setex(
        f"refresh:{token}",
        ttl,
        json.dumps(session_data)
    )
    
    # Добавляем токен в список сессий пользователя
    await redis_client.sadd(f"sessions:{user_id}", token)
    await redis_client.expire(f"sessions:{user_id}", ttl)
    
    logger.debug(f"Refresh token saved for user {user_id}")


async def get_refresh_token(token: str) -> Optional[Dict]:
    """Получает данные сессии по refresh токену."""
    try:
        data = await redis_client.get(f"refresh:{token}")
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def delete_refresh_token(token: str):
    """Удаляет refresh токен (выход из сессии)."""
    try:
        data = await redis_client.get(f"refresh:{token}")
        if data:
            session = json.loads(data)
            user_id = session.get("user_id")
            # Удаляем из списка сессий пользователя
            await redis_client.srem(f"sessions:{user_id}", token)
        await redis_client.delete(f"refresh:{token}")
        logger.debug(f"Refresh token deleted")
    except Exception:
        pass


async def delete_all_user_tokens(user_id: int):
    """Удаляет ВСЕ сессии пользователя (при смене пароля)."""
    try:
        # Получаем все токены пользователя
        tokens = await redis_client.smembers(f"sessions:{user_id}")
        # Удаляем каждый токен
        for token in tokens:
            await redis_client.delete(f"refresh:{token}")
        # Удаляем список сессий
        await redis_client.delete(f"sessions:{user_id}")
        logger.info(f"All sessions deleted for user {user_id}")
    except Exception:
        pass


async def get_user_sessions(user_id: int) -> List[Dict]:
    """Возвращает все активные сессии пользователя."""
    sessions = []
    try:
        tokens = await redis_client.smembers(f"sessions:{user_id}")
        for token in tokens:
            data = await redis_client.get(f"refresh:{token}")
            if data:
                sessions.append(json.loads(data))
    except Exception:
        pass
    return sessions


# Blacklist для access токенов

async def add_to_blacklist(jti: str, ttl: int):
    """
    Добавляет access токен в черный список.
    Используется при выходе, пока токен не истечет естественно.
    """
    try:
        await redis_client.setex(f"blacklist:{jti}", ttl, "revoked")
        logger.debug(f"Token {jti} blacklisted")
    except Exception:
        pass


async def is_blacklisted(jti: str) -> bool:
    """Проверяет, не заблокирован ли токен."""
    try:
        return await redis_client.exists(f"blacklist:{jti}") > 0
    except Exception:
        return False


# Кэширование данных

async def cache_get(key: str) -> Optional[Any]:
    """Получает данные из кэша."""
    try:
        data = await redis_client.get(f"cache:{key}")
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def cache_set(key: str, value: Any, ttl: int = 300):
    """Сохраняет данные в кэш."""
    try:
        await redis_client.setex(
            f"cache:{key}",
            ttl,
            json.dumps(value, default=str)
        )
    except Exception:
        pass


async def cache_delete(key: str):
    """Удаляет данные из кэша."""
    try:
        await redis_client.delete(f"cache:{key}")
    except Exception:
        pass


async def cache_delete_pattern(pattern: str):
    """Удаляет все ключи по паттерну."""
    try:
        keys = await redis_client.keys(f"cache:{pattern}")
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        pass


# Rate limiting

async def check_rate_limit(key: str, max_requests: int, window: int) -> bool:
    """Проверяет лимит запросов. True если можно выполнить."""
    try:
        current = await redis_client.get(f"rate:{key}")
        if current is None:
            await redis_client.setex(f"rate:{key}", window, 1)
            return True
        
        if int(current) >= max_requests:
            return False
        
        await redis_client.incr(f"rate:{key}")
        return True
    except Exception:
        return True