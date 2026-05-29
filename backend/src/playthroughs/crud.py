"""
Асинхронные CRUD операции для работы с прохождениями.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from datetime import datetime
import json

from src.playthroughs import models, schemas
from src.users.models import Status, UserStatus
from src.projects import crud as projects_crud
from src.logger import setup_logger

logger = setup_logger(__name__, 'playthroughs.log')


async def get_playthrough(
    db: AsyncSession,
    playthrough_id: int
) -> Optional[models.Playthrough]:
    """Возвращает прохождение по ID."""
    query = await db.execute(
        select(models.Playthrough).where(
            models.Playthrough.id == playthrough_id
        )
    )
    return query.scalar_one_or_none()


async def get_active_playthrough(
    db: AsyncSession,
    user_id: int,
    project_id: int
) -> Optional[models.Playthrough]:
    """Возвращает незавершенное прохождение пользователя для проекта."""
    query = await db.execute(
        select(models.Playthrough).where(
            models.Playthrough.user_id == user_id,
            models.Playthrough.project_id == project_id,
            models.Playthrough.is_completed == False
        ).order_by(models.Playthrough.started_at.desc())
    )
    return query.scalar_one_or_none()


async def get_user_playthroughs(
    db: AsyncSession,
    user_id: int
) -> List[models.Playthrough]:
    """Возвращает все прохождения пользователя."""
    query = await db.execute(
        select(models.Playthrough).where(
            models.Playthrough.user_id == user_id
        ).order_by(models.Playthrough.created_at.desc())
    )
    return query.scalars().all()


async def create_playthrough(
    db: AsyncSession,
    user_id: int,
    project_id: int
) -> models.Playthrough:
    """Создаёт новое прохождение."""
    playthrough = models.Playthrough(
        user_id=user_id,
        project_id=project_id,
        started_at=datetime.utcnow(),
        total_points=0,
        is_completed=False,
        context_data=None
    )
    db.add(playthrough)
    await db.commit()
    await db.refresh(playthrough)
    return playthrough


async def update_playthrough_context(
    db: AsyncSession,
    playthrough_id: int,
    context_data: dict
) -> Optional[models.Playthrough]:
    """Обновляет контекст прохождения."""
    db_playthrough = await get_playthrough(db, playthrough_id)
    if not db_playthrough or db_playthrough.is_completed:
        return None
    
    db_playthrough.context_data = json.dumps(context_data)
    await db.commit()
    await db.refresh(db_playthrough)
    return db_playthrough


async def complete_playthrough(
    db: AsyncSession,
    playthrough_id: int,
    total_points: int,
    answers: List[dict]
) -> Optional[str]:
    """Завершает прохождение и возвращает статус или сообщение что уже есть."""
    db_playthrough = await get_playthrough(db, playthrough_id)
    if not db_playthrough or db_playthrough.is_completed:
        return None
    
    db_playthrough.total_points = total_points
    db_playthrough.completed_at = datetime.utcnow()
    db_playthrough.is_completed = True
    
    # Сохраняем ответы
    for idx, answer in enumerate(answers):
        db_answer = models.PlaythroughAnswer(
            playthrough_id=playthrough_id,
            scene_id=answer.get('scene_id'),
            node_id=str(answer.get('node_id', '')),
            option_id=str(answer.get('option_id', '')),
            option_text=str(answer.get('text', '')),
            points_earned=answer.get('points', 0),
            order_index=idx
        )
        db.add(db_answer)
    
    # Проверяем статус
    project = await projects_crud.get_project(
        db,
        db_playthrough.project_id
    )
    reward_status = None
    
    if (
        project and
        project.reward_status_id and
        total_points >= project.min_points
    ):
        status_query = await db.execute(
            select(Status).where(
                Status.id == project.reward_status_id
            )
        )
        status = status_query.scalar_one_or_none()
        
        if status:
            # Проверяем, нет ли уже такого статуса
            existing_query = await db.execute(
                select(UserStatus).where(
                    UserStatus.user_id == db_playthrough.user_id,
                    UserStatus.status_id == status.id
                )
            )
            existing = existing_query.scalar_one_or_none()
            
            if not existing:
                user_status = UserStatus(
                    user_id=db_playthrough.user_id,
                    status_id=status.id,
                    playthrough_id=playthrough_id
                )
                db.add(user_status)
                reward_status = status.name
            else:
                reward_status = f"{status.name} (уже имеется)"
    
    await db.commit()
    return reward_status


async def abort_playthrough(
    db: AsyncSession,
    playthrough_id: int
) -> bool:
    """Прерывает (удаляет) незавершенное прохождение."""
    db_playthrough = await get_playthrough(db, playthrough_id)
    if not db_playthrough or db_playthrough.is_completed:
        return False
    
    await db.delete(db_playthrough)
    await db.commit()
    return True


async def get_playthrough_answers(
    db: AsyncSession,
    playthrough_id: int
) -> List[models.PlaythroughAnswer]:
    """Возвращает ответы прохождения."""
    query = await db.execute(
        select(models.PlaythroughAnswer).where(
            models.PlaythroughAnswer.playthrough_id == playthrough_id
        ).order_by(models.PlaythroughAnswer.order_index)
    )
    return query.scalars().all()


async def save_playthrough_progress(
    db: AsyncSession,
    playthrough_id: int,
    context_data: dict,
    current_scene_index: int = 0,
    current_node_id: str = None
) -> Optional[models.Playthrough]:
    """
    Сохраняет текущий прогресс прохождения: контекст, сцену и узел.
    Вызывается после каждого выбора ответа.
    """
    db_playthrough = await get_playthrough(db, playthrough_id)
    if not db_playthrough or db_playthrough.is_completed:
        return None
    
    db_playthrough.context_data = json.dumps(context_data)
    db_playthrough.current_scene_index = current_scene_index
    db_playthrough.current_node_id = current_node_id
    db_playthrough.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_playthrough)
    return db_playthrough