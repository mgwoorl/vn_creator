"""
Модели SQLAlchemy для модуля сцен.
Описывает таблицы: scenes, scene_nodes, node_options, scene_edges.
Все внешние ключи правильно настроены для каскадного удаления.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from src.database import BaseDBModel


class Scene(BaseDBModel):
    """Модель сцены проекта."""
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )
    name = Column(String, nullable=False)
    background_url = Column(String, nullable=True)
    background_type = Column(String, default="image")
    use_video_audio = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    project = relationship("Project", back_populates="scenes")
    nodes = relationship(
        "SceneNode",
        back_populates="scene",
        cascade="all, delete-orphan"
    )
    edges = relationship(
        "SceneEdge",
        back_populates="scene",
        cascade="all, delete-orphan"
    )


class SceneNode(BaseDBModel):
    """
    Модель узла сцены (блока диалога).
    Содержит всю информацию об одном шаге новеллы:
    персонаж, текст, спрайт, музыку и фоновое изображение.
    """
    __tablename__ = "scene_nodes"

    node_uuid = Column(String, primary_key=True)
    scene_id = Column(
        Integer,
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    character_name = Column(String, nullable=True)
    text = Column(Text, nullable=True)
    sprite_file = Column(String, nullable=True)
    music_file = Column(String, nullable=True)
    loop_music = Column(Boolean, default=False)
    is_start = Column(Boolean, default=False)
    background_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    scene = relationship("Scene", back_populates="nodes")
    options = relationship(
        "NodeOption",
        back_populates="node",
        cascade="all, delete-orphan"
    )


class NodeOption(BaseDBModel):
    """Модель варианта ответа в узле диалога."""
    __tablename__ = "node_options"

    option_uuid = Column(String, primary_key=True)
    node_uuid = Column(
        String,
        ForeignKey("scene_nodes.node_uuid", ondelete="CASCADE"),
        nullable=False
    )
    option_text = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_node_uuid = Column(String, nullable=True)
    points = Column(Integer, default=0)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    node = relationship("SceneNode", back_populates="options")


class SceneEdge(BaseDBModel):
    """Модель связи между узлами сцены."""
    __tablename__ = "scene_edges"

    edge_uuid = Column(String, primary_key=True)
    scene_id = Column(
        Integer,
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=False
    )
    source_node_uuid = Column(
        String,
        ForeignKey("scene_nodes.node_uuid", ondelete="CASCADE"),
        nullable=False
    )
    source_handle = Column(String, nullable=False)
    target_node_uuid = Column(
        String,
        ForeignKey("scene_nodes.node_uuid", ondelete="CASCADE"),
        nullable=False
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    scene = relationship("Scene", back_populates="edges")