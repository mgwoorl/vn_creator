"""
Pydantic схемы для валидации данных модуля пользователей.
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


class UserCreateByAdmin(BaseModel):
    """Схема для создания пользователя администратором."""
    email: EmailStr
    last_name: str
    first_name: str
    patronymic: Optional[str] = ""
    password: str
    role: str = "student"
    group_id: Optional[int] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        allowed = ['student', 'teacher', 'admin', 'super_admin']
        if v not in allowed:
            raise ValueError(f'Роль должна быть одной из: {allowed}')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 4:
            raise ValueError('Пароль должен быть не менее 4 символов')
        return v


class UserRegister(BaseModel):
    """Схема для самостоятельной регистрации пользователя."""
    email: EmailStr
    last_name: str
    first_name: str
    patronymic: Optional[str] = ""
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 4:
            raise ValueError('Пароль должен быть не менее 4 символов')
        return v


class UserLogin(BaseModel):
    """Схема для входа в систему."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Схема ответа с данными пользователя."""
    id: int
    email: str
    last_name: str
    first_name: str
    patronymic: Optional[str] = ""
    role: str
    group_id: Optional[int] = None
    is_active: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    """Схема запроса на смену пароля пользователем."""
    old_password: str
    new_password: str


class AdminResetPasswordRequest(BaseModel):
    """Схема запроса на сброс пароля администратором."""
    new_password: str


class AdminUpdateUserRequest(BaseModel):
    """Схема обновления данных пользователя администратором."""
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    group_id: Optional[int] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v is None:
            return v
        allowed = ['student', 'teacher', 'admin']
        if v not in allowed:
            raise ValueError(f'Роль должна быть одной из: {allowed}')
        return v


class GroupBase(BaseModel):
    """Базовая схема группы."""
    name: str


class GroupCreate(GroupBase):
    """Схема создания группы."""
    pass


class GroupUpdate(BaseModel):
    """Схема обновления группы."""
    name: Optional[str] = None


class GroupResponse(BaseModel):
    """Схема ответа с данными группы."""
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True