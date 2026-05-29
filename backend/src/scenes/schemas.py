"""
Pydantic схемы для валидации данных модуля сцен.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SceneBase(BaseModel):
    """Базовая схема сцены."""
    name: str
    background_url: Optional[str] = None
    background_type: str = "image"
    order_index: int = 0


class SceneCreate(SceneBase):
    """Схема для создания сцены."""
    project_id: int


class SceneUpdate(BaseModel):
    """Схема для обновления сцены."""
    name: Optional[str] = None
    background_url: Optional[str] = None
    background_type: Optional[str] = None
    order_index: Optional[int] = None


class SceneResponse(SceneBase):
    """Схема для ответа с данными сцены."""
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True