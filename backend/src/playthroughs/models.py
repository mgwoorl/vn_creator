"""
Модели SQLAlchemy для модуля прохождений.
Описывает таблицы: playthroughs, playthrough_answers.
"""
from sqlalchemy import (
    Column, Integer, String, ForeignKey,
    DateTime, Boolean, Text, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import BaseDBModel


class Playthrough(BaseDBModel):
    """Модель прохождения проекта."""
    __tablename__ = "playthroughs"
    __table_args__ = (
        Index(
            'ix_playthroughs_user_project',
            'user_id',
            'project_id'
        ),
        Index(
            'ix_playthroughs_user_completed',
            'user_id',
            'is_completed'
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    total_points = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    context_data = Column(Text, nullable=True)
    current_scene_index = Column(Integer, default=0)
    current_node_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    user = relationship("User", back_populates="playthroughs")
    project = relationship("Project")
    answers = relationship(
        "PlaythroughAnswer",
        back_populates="playthrough",
        cascade="all, delete-orphan"
    )


class PlaythroughAnswer(BaseDBModel):
    """Модель ответа пользователя в прохождении."""
    __tablename__ = "playthrough_answers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    playthrough_id = Column(
        Integer,
        ForeignKey("playthroughs.id", ondelete="CASCADE"),
        nullable=False
    )
    scene_id = Column(
        Integer,
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=True
    )
    node_id = Column(String, nullable=False)
    option_id = Column(String, nullable=False)
    option_text = Column(String, nullable=False)
    points_earned = Column(Integer, default=0)
    order_index = Column(Integer, default=0)
    answered_at = Column(DateTime, default=datetime.utcnow)
    
    playthrough = relationship(
        "Playthrough",
        back_populates="answers"
    )
    scene = relationship("Scene")