"""
Асинхронные маршруты для работы со сценами.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from src.database import get_db
from src.projects.models import Project
from src.users.router import get_current_user_from_token
from src.scenes import crud, schemas

router = APIRouter(prefix="/scenes", tags=["scenes"])


async def check_project_access(
    db: AsyncSession,
    project_id: int,
    user
) -> bool:
    """
    Проверяет доступ пользователя к проекту.
    Учитель имеет доступ только к своим проектам.
    Администратор и супер-админ имеют доступ ко всем проектам.
    """
    query = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = query.scalar_one_or_none()
    
    if not project:
        return False

    if user.role in ["admin", "super_admin"]:
        return True

    if user.role == "teacher" and project.owner_id == user.id:
        return True

    return False


@router.post("/", response_model=schemas.SceneResponse)
async def create_scene(
    project_id: int = Query(...),
    scene_data: schemas.SceneCreate = None,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Создаёт новую сцену в проекте."""
    if not await check_project_access(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    name = "Новая сцена"
    if scene_data and hasattr(scene_data, 'name'):
        name = scene_data.name

    scene = await crud.create_scene(db, project_id, name)
    return scene


@router.get(
    "/project/{project_id}",
    response_model=List[schemas.SceneResponse]
)
async def get_project_scenes(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает все сцены проекта."""
    query = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = query.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if current_user.role == "student":
        if not project.is_published:
            raise HTTPException(
                status_code=403,
                detail="Проект не опубликован"
            )

    return await crud.get_project_scenes(db, project_id)


@router.get("/{scene_id}")
async def get_scene(
    scene_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает сцену по идентификатору."""
    scene = await crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    return scene


@router.get("/{scene_id}/full")
async def get_full_scene(
    scene_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает полные данные сцены со всеми узлами и связями."""
    scene_data = await crud.get_full_scene(db, scene_id)
    if not scene_data:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    return scene_data


@router.put("/{scene_id}")
async def update_scene(
    scene_id: int,
    scene_update: schemas.SceneUpdate,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Обновляет основную информацию сцены."""
    scene = await crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not await check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    updated = await crud.update_scene(db, scene_id, scene_update)
    return updated


@router.put("/{scene_id}/full")
async def save_full_scene(
    scene_id: int,
    scene_data: dict,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Сохраняет полные данные сцены (узлы, опции, связи)."""
    scene = await crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not await check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    updated = await crud.save_full_scene(db, scene_id, scene_data)
    if not updated:
        raise HTTPException(
            status_code=500,
            detail="Ошибка сохранения сцены"
        )

    return updated


@router.delete("/{scene_id}")
async def delete_scene(
    scene_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет сцену."""
    scene = await crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not await check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    await crud.delete_scene(db, scene_id)
    return {"message": "Сцена удалена"}


@router.delete("/{scene_id}/nodes/{node_id}")
async def delete_scene_node(
    scene_id: int,
    node_id: str,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет узел сцены и все связанные с ним опции."""
    scene = await crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not await check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    result = await crud.delete_node(db, node_id)
    if not result:
        raise HTTPException(status_code=404, detail="Узел не найден")

    return {"message": "Узел удалён"}


@router.delete("/{scene_id}/nodes/{node_id}/options/{option_id}")
async def delete_node_option(
    scene_id: int,
    node_id: str,
    option_id: str,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет опцию узла."""
    scene = await crud.get_scene(db, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Сцена не найдена")

    if not await check_project_access(db, scene.project_id, current_user):
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    result = await crud.delete_option(db, option_id)
    if not result:
        raise HTTPException(status_code=404, detail="Опция не найдена")

    return {"message": "Опция удалена"}