"""
Централизованная система логирования для backend.
Поддерживает цветной вывод в консоль и ротацию файлов.
"""
import logging
import sys
from datetime import datetime
from pathlib import Path
from logging.handlers import RotatingFileHandler
import os

# Директория для логов
LOG_DIR = Path("./logs")
LOG_DIR.mkdir(exist_ok=True)


class ColoredFormatter(logging.Formatter):
    """Форматтер с цветами для консоли."""
    
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        log_message = super().format(record)
        color = self.COLORS.get(record.levelname, '')
        return f"{color}{log_message}{self.RESET}"


def setup_logger(name: str, log_file: str = None) -> logging.Logger:
    """
    Настраивает и возвращает логгер с указанным именем.
    
    Параметры:
        name: Имя логгера (обычно __name__ модуля)
        log_file: Имя файла для записи логов (опционально)
    
    Возвращает:
        Настроенный logging.Logger
    """
    logger = logging.getLogger(name)
    
    # Избегаем дублирования handler'ов
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.DEBUG)
    
    # Формат для файлов
    file_formatter = logging.Formatter(
        '[%(asctime)s][%(levelname)-8s][%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Формат для консоли с цветами
    console_formatter = ColoredFormatter(
        '[%(asctime)s][%(levelname)-8s][%(name)s] %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # Консольный handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # Файловый handler (если указан)
    if log_file:
        file_handler = RotatingFileHandler(
            LOG_DIR / log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    # Глобальный файловый handler для всех ошибок
    error_handler = RotatingFileHandler(
        LOG_DIR / 'errors.log',
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    logger.addHandler(error_handler)
    
    return logger


def log_function_call(logger: logging.Logger):
    """
    Декоратор для логирования вызовов функций.
    Поддерживает как синхронные, так и асинхронные функции.
    """
    import asyncio
    
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                logger.debug(
                    f"→ {func.__name__}("
                    f"args={args[1:] if len(args) > 1 else '()'}, "
                    f"kwargs={kwargs})"
                )
                try:
                    result = await func(*args, **kwargs)
                    logger.debug(f"← {func.__name__} completed")
                    return result
                except Exception as e:
                    logger.error(f"✕ {func.__name__} failed: {str(e)}")
                    raise
            return async_wrapper
        else:
            def sync_wrapper(*args, **kwargs):
                logger.debug(
                    f"→ {func.__name__}("
                    f"args={args[1:] if len(args) > 1 else '()'}, "
                    f"kwargs={kwargs})"
                )
                try:
                    result = func(*args, **kwargs)
                    logger.debug(f"← {func.__name__} completed")
                    return result
                except Exception as e:
                    logger.error(f"✕ {func.__name__} failed: {str(e)}")
                    raise
            return sync_wrapper
    
    return decorator


# Глобальные логгеры для основных модулей
api_logger = setup_logger('api', 'api.log')
db_logger = setup_logger('database', 'database.log')
auth_logger = setup_logger('auth', 'auth.log')