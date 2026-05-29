"""
Pydantic схемы для модуля прохождений.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class StartPlaythroughResponse(BaseModel):
    """Ответ при старте прохождения."""
    success: bool
    playthrough_id: int
    message: str
    last_scene_index: Optional[int] = 0
    last_node_id: Optional[str] = None
    context_data: Optional[dict] = None
    is_resumed: bool = False


class AnswerItem(BaseModel):
    """Элемент ответа пользователя."""
    scene_id: Optional[int] = None
    node_id: Optional[str] = ""
    option_id: Optional[str] = ""
    text: str = ""
    points: int = 0


class CompletePlaythroughRequest(BaseModel):
    """Запрос на завершение прохождения."""
    total_points: int = 0
    answers: List[AnswerItem] = []


class CompletePlaythroughResponse(BaseModel):
    """Ответ при завершении прохождения."""
    success: bool
    reward_status: Optional[str] = None
    total_points: int
    message: str


class SaveProgressRequest(BaseModel):
    """Запрос на сохранение прогресса."""
    context_data: dict
    current_scene_index: int = 0
    current_node_id: Optional[str] = None


class CompletedProjectsResponse(BaseModel):
    """Ответ со списком завершенных проектов."""
    completed_ids: List[int] = []