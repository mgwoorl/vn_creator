"""
Модели SQLAlchemy для модуля пользователей.
Описывает таблицы: users, statuses, groups, user_statuses.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import BaseDBModel


class Status(BaseDBModel):
    """Модель статуса, который может получить пользователь."""
    __tablename__ = "statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    required_in_projects = relationship(
        "ProjectRequiredStatus",
        back_populates="status",
        cascade="all, delete-orphan"
    )
    awarded_to_users = relationship(
        "UserStatus",
        back_populates="status",
        cascade="all, delete-orphan"
    )


class Group(BaseDBModel):
    """Модель учебной группы."""
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="group")
    project_links = relationship(
        "ProjectGroup",
        back_populates="group",
        cascade="all, delete-orphan"
    )


class User(BaseDBModel):
    """
    Модель пользователя системы.
    Поддерживает роли: student, teacher, admin, super_admin.
    При регистрации создаётся неактивным (is_active=False).
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    last_name = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    patronymic = Column(String, nullable=True)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="student")
    group_id = Column(
        Integer,
        ForeignKey("groups.id", ondelete="SET NULL"),
        nullable=True
    )
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    group = relationship("Group", back_populates="users")
    projects = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan"
    )
    statuses = relationship(
        "UserStatus",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    playthroughs = relationship(
        "Playthrough",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class UserStatus(BaseDBModel):
    """Связь пользователя и полученного им статуса."""
    __tablename__ = "user_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    status_id = Column(
        Integer,
        ForeignKey("statuses.id", ondelete="CASCADE"),
        nullable=False
    )
    playthrough_id = Column(
        Integer,
        ForeignKey("playthroughs.id", ondelete="SET NULL"),
        nullable=True
    )
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="statuses")
    status = relationship("Status", back_populates="awarded_to_users")
    playthrough = relationship("Playthrough")