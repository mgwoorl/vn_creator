"""
Асинхронные маршруты для работы с проектами.
"""
import os
import json
import uuid
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import get_db
from src.users.router import get_current_user_from_token
from src.users import crud as users_crud
from src.projects import crud as projects_crud
from src.projects import schemas, models
from src.scenes import crud as scenes_crud
from src.utils.s3_client import (
    upload_file, delete_file_by_name, delete_file_by_url,
    list_files, rename_file, delete_file_and_cleanup
)
from src.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


async def get_project_dict(db: AsyncSession, project_id: int) -> dict:
    """Формирует словарь с полной информацией о проекте по его ID."""
    # Получаем проект
    project_query = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_query.scalar_one_or_none()
    if not project:
        return {}

    scenes = await scenes_crud.get_project_scenes(db, project_id)

    # Загружаем required_statuses отдельно
    req_query = await db.execute(
        select(models.ProjectRequiredStatus).where(
            models.ProjectRequiredStatus.project_id == project_id
        )
    )
    required_statuses = req_query.scalars().all()

    required_names = []
    for rs in required_statuses:
        status_query = await db.execute(
            select(users_crud.models.Status).where(
                users_crud.models.Status.id == rs.status_id
            )
        )
        status = status_query.scalar_one_or_none()
        if status:
            required_names.append(status.name)

    # Статус-награда
    reward_status_name = None
    if project.reward_status_id:
        reward_query = await db.execute(
            select(users_crud.models.Status).where(
                users_crud.models.Status.id == project.reward_status_id
            )
        )
        reward_status = reward_query.scalar_one_or_none()
        if reward_status:
            reward_status_name = reward_status.name

    # Группы
    groups = await projects_crud.get_project_groups(db, project_id)
    group_names = [g.name for g in groups]
    group_ids = [g.id for g in groups]

    return {
        'id': project.id,
        'title': project.title,
        'description': project.description,
        'cover_url': project.cover_url,
        'owner_id': project.owner_id,
        'is_published': project.is_published,
        'min_points': project.min_points,
        'reward_status': reward_status_name,
        'created_at': project.created_at,
        'updated_at': project.updated_at,
        'scenes_count': len(scenes),
        'required_statuses': required_names,
        'groups': group_names,
        'group_ids': group_ids,
        'scenes': [{
            'id': s.id,
            'name': s.name,
            'background_url': s.background_url,
            'background_type': s.background_type,
            'order_index': s.order_index
        } for s in scenes]
    }


@router.get("")
@router.get("/")
async def get_projects(
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает список проектов, доступных текущему пользователю."""
    if current_user.role == "teacher":
        projects = await projects_crud.get_projects_by_owner(db, current_user.id)
    elif current_user.role in ["admin", "super_admin"]:
        projects_query = await db.execute(
            select(models.Project).order_by(models.Project.created_at.desc())
        )
        projects = projects_query.scalars().all()
    else:
        return await projects_crud.get_available_projects_for_user(db, current_user.id)

    result = []
    for p in projects:
        result.append(await get_project_dict(db, p.id))
    return result


@router.post("/")
async def create_project(
    title: str = Form(...),
    description: str = Form(""),
    min_points: int = Form(0),
    reward_status: str = Form("Стажёр"),
    required_statuses: str = Form("[]"),
    group_ids: str = Form("[]"),
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Создаёт новый проект."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Только для учителей")

    try:
        required_list = json.loads(required_statuses) if required_statuses else []
    except:
        required_list = []

    try:
        groups_list = json.loads(group_ids) if group_ids else []
        groups_list = [int(g) for g in groups_list]
    except:
        groups_list = []

    project_data = schemas.ProjectCreate(
        title=title,
        description=description,
        min_points=min_points,
        reward_status=reward_status,
        required_statuses=required_list,
        group_ids=groups_list
    )
    project = await projects_crud.create_project(db, project_data, current_user.id)
    return await get_project_dict(db, project.id)


@router.get("/statuses/all")
async def get_all_statuses(
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает список всех статусов."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    return await projects_crud.get_all_statuses(db)


@router.post("/statuses/add")
async def add_status(
    request: dict,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Добавляет новый статус."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    status_name = request.get("name", "").strip()
    if not status_name:
        raise HTTPException(status_code=400, detail="Название статуса обязательно")

    status_query = await db.execute(
        select(users_crud.models.Status).where(users_crud.models.Status.name == status_name)
    )
    if status_query.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Статус с таким названием уже существует")

    status = users_crud.models.Status(name=status_name, description="")
    db.add(status)
    await db.commit()
    await db.refresh(status)
    return {"id": status.id, "name": status.name, "description": status.description or ""}


@router.delete("/statuses/{status_id}")
async def delete_status(
    status_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет статус."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    status_query = await db.execute(
        select(users_crud.models.Status).where(users_crud.models.Status.id == status_id)
    )
    status = status_query.scalar_one_or_none()
    if not status:
        raise HTTPException(status_code=404, detail="Статус не найден")
    if status.name == "Стажёр":
        raise HTTPException(status_code=400, detail="Нельзя удалить базовый статус")

    await db.delete(status)
    await db.commit()
    return {"message": "Статус удалён"}


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает информацию о проекте."""
    project_query = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_query.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if current_user.role == "student":
        available = await projects_crud.get_available_projects_for_user(db, current_user.id)
        for p in available:
            if p['id'] == project.id:
                return p
        raise HTTPException(status_code=403, detail="Проект недоступен")

    if current_user.role == "teacher" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    return await get_project_dict(db, project_id)


@router.put("/{project_id}")
async def update_project(
    project_id: int,
    project_data: schemas.ProjectUpdate,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Обновляет проект."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project_query = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_query.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if current_user.role == "teacher" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    if project_data.is_published:
        scenes = await scenes_crud.get_project_scenes(db, project_id)
        if not scenes:
            raise HTTPException(status_code=400, detail="Нельзя опубликовать проект без сцен")

    await projects_crud.update_project(db, project_id, project_data)
    return await get_project_dict(db, project_id)


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет проект."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project_query = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_query.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if current_user.role == "teacher" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    for folder in ['backgrounds', 'sprites', 'music', 'covers']:
        files_result = list_files(f"projects/{project_id}/{folder}")
        for file_info in files_result.get("files", []):
            delete_file_by_name(file_info["name"], f"projects/{project_id}/{folder}")

    await projects_crud.delete_project(db, project_id)
    return {"message": "Проект удален"}


@router.get("/{project_id}/files")
async def get_project_files(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает файлы проекта."""
    project_query = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    if not project_query.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Проект не найден")

    return {
        "backgrounds": list_files(f"projects/{project_id}/backgrounds").get("files", []),
        "sprites": list_files(f"projects/{project_id}/sprites").get("files", []),
        "music": list_files(f"projects/{project_id}/music").get("files", []),
        "covers": list_files(f"projects/{project_id}/covers").get("files", [])
    }


@router.post("/{project_id}/upload/{resource_type}")
async def upload_resource(
    project_id: int,
    resource_type: str,
    file: UploadFile = File(...),
    custom_name: Optional[str] = Form(None),
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Загружает файл."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project_query = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_query.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if current_user.role == "teacher" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    allowed_types = {
        'backgrounds': ['.jpg', '.jpeg', '.png', '.mp4'],
        'sprites': ['.png'],
        'music': ['.mp3'],
        'covers': ['.jpg', '.jpeg', '.png']
    }

    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_types.get(resource_type, []):
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат файла")

    file_data = await file.read()
    file_name = f"{custom_name}{ext}" if custom_name else file.filename

    result = upload_file(
        file_data=file_data,
        file_name=file_name,
        folder=f"projects/{project_id}/{resource_type}"
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки: {result.get('error')}")

    return {
        "id": result.get("file_id", str(uuid.uuid4())),
        "name": result.get("name", file_name),
        "url": result.get("url", ""),
        "type": result.get("file_type", "image"),
        "size": result.get("size", len(file_data))
    }


@router.post("/{project_id}/upload/{resource_type}/batch")
async def upload_resources_batch(
    project_id: int,
    resource_type: str,
    files: List[UploadFile] = File(...),
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Загружает несколько файлов."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project_query = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_query.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    if current_user.role == "teacher" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    allowed_types = {
        'backgrounds': ['.jpg', '.jpeg', '.png', '.mp4'],
        'sprites': ['.png'],
        'music': ['.mp3'],
        'covers': ['.jpg', '.jpeg', '.png']
    }

    uploaded_files = []
    errors = []

    for file in files:
        try:
            ext = Path(file.filename).suffix.lower()
            if ext not in allowed_types.get(resource_type, []):
                errors.append(f"{file.filename}: неподдерживаемый формат")
                continue
            file_data = await file.read()
            result = upload_file(file_data=file_data, file_name=file.filename, folder=f"projects/{project_id}/{resource_type}")
            if result["success"]:
                uploaded_files.append({
                    "id": result.get("file_id", str(uuid.uuid4())),
                    "name": result.get("name", file.filename),
                    "url": result.get("url", ""),
                    "type": result.get("file_type", "image"),
                    "size": result.get("size", len(file_data))
                })
            else:
                errors.append(f"{file.filename}: ошибка загрузки")
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    return {"success": len(errors) == 0, "uploaded": len(uploaded_files), "files": uploaded_files, "errors": errors}


@router.put("/{project_id}/files/{resource_type}/{file_name}")
async def rename_resource(
    project_id: int,
    resource_type: str,
    file_name: str,
    request: dict,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Переименовывает файл."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    result = rename_file(old_name=file_name, new_name=request.get('new_name', ''), folder=f"projects/{project_id}/{resource_type}")
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Ошибка переименования"))
    return {"message": "Файл переименован", "new_name": result["name"], "url": result.get("url", "")}


@router.delete("/{project_id}/files/{resource_type}/{file_name}")
async def delete_resource(
    project_id: int,
    resource_type: str,
    file_name: str,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет файл."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    folder = f"projects/{project_id}/{resource_type}"
    result = delete_file_and_cleanup(file_name, folder, db, project_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Ошибка удаления"))
    return {"message": "Файл удален и ссылки очищены"}


@router.get("/{project_id}/analytics")
async def get_project_analytics(
    project_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает аналитику."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    return await projects_crud.get_project_analytics(db, project_id)


@router.get("/{project_id}/student/{user_id}/playthroughs")
async def get_student_playthroughs(
    project_id: int,
    user_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает прохождения студента."""
    if current_user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    from src.playthroughs.models import Playthrough
    playthroughs_query = await db.execute(
        select(Playthrough).where(
            Playthrough.project_id == project_id,
            Playthrough.user_id == user_id,
            Playthrough.is_completed == True
        ).order_by(Playthrough.completed_at.desc())
    )
    playthroughs = playthroughs_query.scalars().all()
    return [{"playthrough_id": p.id, "total_points": p.total_points, "completed_at": p.completed_at} for p in playthroughs]