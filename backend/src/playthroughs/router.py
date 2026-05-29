"""
Асинхронные маршруты для работы с прохождениями.
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from src.database import get_db
from src.users.router import get_current_user_from_token
from src.projects import crud as projects_crud
from src.playthroughs import crud, schemas, models
from src.scenes.models import SceneNode, Scene

router = APIRouter(prefix="/playthroughs", tags=["playthroughs"])


@router.post(
    "/start",
    response_model=schemas.StartPlaythroughResponse
)
async def start_playthrough(
    project_id: int = Query(...),
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Начинает новое прохождение или восстанавливает незавершённое.
    """
    if current_user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="Только студенты могут проходить проекты"
        )
    
    project = await projects_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail="Проект не найден"
        )
    
    if not project.is_published:
        raise HTTPException(
            status_code=403,
            detail="Проект не опубликован"
        )
    
    # Проверяем, есть ли незавершённое прохождение
    existing = await crud.get_active_playthrough(
        db,
        current_user.id,
        project_id
    )
    
    if existing and existing.context_data:
        # Восстанавливаем незавершённое прохождение
        try:
            context_data = json.loads(existing.context_data)
        except (json.JSONDecodeError, TypeError):
            context_data = None
        
        return schemas.StartPlaythroughResponse(
            success=True,
            playthrough_id=existing.id,
            message="Прохождение восстановлено",
            last_scene_index=existing.current_scene_index or 0,
            last_node_id=existing.current_node_id,
            context_data=context_data,
            is_resumed=True
        )
    
    # Создаём новое прохождение
    playthrough = await crud.create_playthrough(
        db,
        current_user.id,
        project_id
    )
    
    return schemas.StartPlaythroughResponse(
        success=True,
        playthrough_id=playthrough.id,
        message="Прохождение начато",
        last_scene_index=0,
        last_node_id=None,
        context_data=None,
        is_resumed=False
    )


@router.post("/{playthrough_id}/save-progress")
async def save_progress(
    playthrough_id: int,
    request_data: schemas.SaveProgressRequest,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Сохраняет текущий прогресс прохождения после каждого выбора ответа.
    """
    playthrough = await crud.get_playthrough(db, playthrough_id)
    if not playthrough:
        raise HTTPException(
            status_code=404,
            detail="Прохождение не найдено"
        )
    
    if playthrough.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Доступ запрещен"
        )
    
    if playthrough.is_completed:
        raise HTTPException(
            status_code=400,
            detail="Прохождение уже завершено"
        )
    
    await crud.save_playthrough_progress(
        db,
        playthrough_id,
        request_data.context_data,
        request_data.current_scene_index,
        request_data.current_node_id
    )
    
    return {"success": True, "message": "Прогресс сохранён"}


@router.post(
    "/{playthrough_id}/complete",
    response_model=schemas.CompletePlaythroughResponse
)
async def complete_playthrough(
    playthrough_id: int,
    request_data: schemas.CompletePlaythroughRequest,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Завершает прохождение и начисляет статус."""
    playthrough = await crud.get_playthrough(db, playthrough_id)
    if not playthrough:
        raise HTTPException(
            status_code=404,
            detail="Прохождение не найдено"
        )
    
    if playthrough.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Доступ запрещен"
        )
    
    if playthrough.is_completed:
        raise HTTPException(
            status_code=400,
            detail="Прохождение уже завершено"
        )
    
    answers_list = []
    for ans in request_data.answers:
        answers_list.append({
            'scene_id': ans.scene_id,
            'node_id': ans.node_id or '',
            'option_id': ans.option_id or '',
            'text': ans.text or '',
            'points': ans.points or 0
        })
    
    reward_status = await crud.complete_playthrough(
        db,
        playthrough_id,
        request_data.total_points,
        answers_list
    )
    
    return schemas.CompletePlaythroughResponse(
        success=True,
        reward_status=reward_status,
        total_points=request_data.total_points,
        message="Прохождение завершено"
    )


@router.delete("/{playthrough_id}")
async def delete_playthrough(
    playthrough_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет (прерывает) незавершённое прохождение."""
    playthrough = await crud.get_playthrough(db, playthrough_id)
    if not playthrough:
        raise HTTPException(
            status_code=404,
            detail="Прохождение не найдено"
        )
    
    if playthrough.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Доступ запрещён"
        )
    
    if playthrough.is_completed:
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить завершённое прохождение"
        )
    
    result = await crud.abort_playthrough(db, playthrough_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail="Не удалось удалить прохождение"
        )
    
    return {"message": "Прохождение прервано"}


@router.get(
    "/completed",
    response_model=schemas.CompletedProjectsResponse
)
async def get_completed_projects(
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает ID проектов, которые пользователь успешно завершил."""
    playthroughs_query = await db.execute(
        select(models.Playthrough).where(
            models.Playthrough.user_id == current_user.id,
            models.Playthrough.is_completed == True
        )
    )
    playthroughs = playthroughs_query.scalars().all()
    
    completed_ids = list(set([p.project_id for p in playthroughs]))
    return schemas.CompletedProjectsResponse(
        completed_ids=completed_ids
    )


@router.get("/{playthrough_id}/answers")
async def get_playthrough_answers(
    playthrough_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает все ответы прохождения."""
    playthrough = await crud.get_playthrough(db, playthrough_id)
    if not playthrough:
        raise HTTPException(
            status_code=404,
            detail="Прохождение не найдено"
        )
    
    if (
        playthrough.user_id != current_user.id
        and current_user.role not in ["teacher", "admin", "super_admin"]
    ):
        raise HTTPException(
            status_code=403,
            detail="Доступ запрещен"
        )
    
    answers = await crud.get_playthrough_answers(db, playthrough_id)
    
    scene_map = {}
    node_map = {}
    
    for answer in answers:
        if answer.scene_id and answer.scene_id not in scene_map:
            scene_query = await db.execute(
                select(Scene).where(Scene.id == answer.scene_id)
            )
            scene = scene_query.scalar_one_or_none()
            if scene:
                scene_map[answer.scene_id] = {
                    "name": scene.name,
                    "order": scene.order_index
                }
        
        if answer.node_id and answer.node_id not in node_map:
            node_query = await db.execute(
                select(SceneNode).where(
                    SceneNode.node_uuid == answer.node_id
                )
            )
            node = node_query.scalar_one_or_none()
            if node:
                node_map[answer.node_id] = node.text or ""
    
    result = []
    for a in answers:
        scene_info = scene_map.get(
            a.scene_id,
            {"name": f"Сцена {a.scene_id}", "order": a.scene_id}
        )
        node_text = node_map.get(a.node_id, "")
        
        result.append({
            "id": a.id,
            "playthrough_id": a.playthrough_id,
            "scene_id": a.scene_id,
            "scene_name": scene_info["name"],
            "scene_order": scene_info["order"],
            "node_id": a.node_id,
            "node_text": node_text[:100] if node_text else "",
            "option_id": a.option_id,
            "option_text": a.option_text,
            "points_earned": a.points_earned,
            "order_index": a.order_index,
            "answered_at": a.answered_at
        })
    
    return result