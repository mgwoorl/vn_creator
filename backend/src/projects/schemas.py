"""
Pydantic схемы для валидации данных модуля проектов.
"""
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class ProjectBase(BaseModel):
    """Базовая схема проекта."""
    title: str
    description: Optional[str] = ""
    min_points: int = 0
    reward_status: str = "Стажёр"
    required_statuses: List[str] = []
    group_ids: List[int] = []

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Project title is required')
        return v.strip()
    
    @field_validator('min_points')
    @classmethod
    def validate_min_points(cls, v):
        if v < 0:
            raise ValueError('Min points cannot be negative')
        return v


class ProjectCreate(ProjectBase):
    """Схема для создания проекта."""
    pass


class ProjectUpdate(BaseModel):
    """Схема для обновления проекта."""
    title: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    is_published: Optional[bool] = None
    min_points: Optional[int] = None
    reward_status: Optional[str] = None
    required_statuses: Optional[List[str]] = None
    group_ids: Optional[List[int]] = None


class ProjectResponse(ProjectBase):
    """Схема для ответа с данными проекта."""
    id: int
    owner_id: int
    cover_url: Optional[str] = None
    is_published: bool
    created_at: datetime
    updated_at: datetime
    scenes_count: int = 0
    groups: List[str] = []

    class Config:
        from_attributes = True


class ProjectDetailResponse(ProjectResponse):
    """Схема с детальной информацией о проекте."""
    scenes: List = []