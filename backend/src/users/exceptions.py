"""
Кастомные исключения для модуля пользователей.
Наследуются от HTTPException для автоматической обработки FastAPI.
"""
from fastapi import HTTPException, status


class UserNotFoundError(HTTPException):
    """Пользователь не найден (404)."""
    def __init__(self, detail: str = "Пользователь не найден"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class UserAuthenticationError(HTTPException):
    """Ошибка аутентификации (401)."""
    def __init__(self, detail: str = "Неверные учетные данные"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail
        )


class UserPermissionError(HTTPException):
    """Недостаточно прав (403)."""
    def __init__(self, detail: str = "Доступ запрещен"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class UserValidationError(HTTPException):
    """Ошибка валидации данных (400)."""
    def __init__(self, detail: str = "Ошибка валидации"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class EmailAlreadyExistsError(HTTPException):
    """Email уже используется (400)."""
    def __init__(self, detail: str = "Email уже зарегистрирован"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class CannotDeleteYourselfError(HTTPException):
    """Попытка удалить самого себя (403)."""
    def __init__(self, detail: str = "Нельзя удалить самого себя"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class CannotChangeSuperAdminError(HTTPException):
    """Попытка изменить роль супер-админа (403)."""
    def __init__(self, detail: str = "Нельзя изменить роль супер-админа"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class InvalidRoleError(HTTPException):
    """Невалидная роль (400)."""
    def __init__(self, detail: str = "Невалидная роль"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )