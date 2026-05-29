"""
Асинхронные CRUD операции для работы с проектами в базе данных.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime

from src.projects import models, schemas
from src.users import crud as users_crud
from src.scenes import crud as scenes_crud
from src.users.models import Status, UserStatus, Group
from src.projects.exceptions import (
    ProjectNotFoundError,
    ProjectValidationError,
    StatusNotFoundError
)


async def get_project(db: AsyncSession, project_id: int) -> Optional[models.Project]:
    if not project_id:
        return None
    query = await db.execute(select(models.Project).where(models.Project.id == project_id))
    return query.scalar_one_or_none()


async def get_projects_by_owner(db: AsyncSession, owner_id: int) -> List[models.Project]:
    if not owner_id:
        return []
    query = await db.execute(
        select(models.Project)
        .where(models.Project.owner_id == owner_id)
        .order_by(models.Project.created_at.desc())
    )
    return query.scalars().all()


async def get_published_projects(db: AsyncSession) -> List[models.Project]:
    query = await db.execute(
        select(models.Project)
        .options(
            selectinload(models.Project.required_statuses),
            selectinload(models.Project.group_links)
        )
        .where(models.Project.is_published == True)
    )
    return query.unique().scalars().all()


async def get_available_projects_for_user(
    db: AsyncSession,
    user_id: int
) -> List[dict]:
    """
    Возвращает список проектов, доступных пользователю.
    """
    user = await users_crud.get_user_by_id(db, user_id)
    if not user:
        return []

    user_statuses_query = await db.execute(
        select(UserStatus).where(UserStatus.user_id == user_id)
    )
    user_statuses = user_statuses_query.scalars().all()
    user_status_ids = [us.status_id for us in user_statuses]
    user_group_id = user.group_id

    projects_query = await db.execute(
        select(models.Project)
        .options(
            selectinload(models.Project.required_statuses),
            selectinload(models.Project.group_links)
        )
        .where(models.Project.is_published == True)
    )
    all_published = projects_query.unique().scalars().all()

    available_projects = []

    for project in all_published:
        required_status_ids = [rs.status_id for rs in project.required_statuses]

        if required_status_ids:
            has_any_required = any(
                status_id in user_status_ids
                for status_id in required_status_ids
            )
            if not has_any_required:
                continue

        if project.group_links:
            project_group_ids = [pg.group_id for pg in project.group_links]
            if user_group_id not in project_group_ids:
                continue

        reward_status = None
        if project.reward_status_id:
            reward_query = await db.execute(
                select(Status).where(Status.id == project.reward_status_id)
            )
            status = reward_query.scalar_one_or_none()
            if status:
                reward_status = status.name

        required_names = []
        for rs in project.required_statuses:
            status_query = await db.execute(
                select(Status).where(Status.id == rs.status_id)
            )
            status = status_query.scalar_one_or_none()
            if status:
                required_names.append(status.name)

        group_names = []
        for pg in project.group_links:
            group_query = await db.execute(
                select(Group).where(Group.id == pg.group_id)
            )
            group = group_query.scalar_one_or_none()
            if group:
                group_names.append(group.name)

        scenes = await scenes_crud.get_project_scenes(db, project.id)

        # Исправлено: limit(1) + first() вместо scalar_one_or_none()
        from src.playthroughs.models import Playthrough
        playthrough_query = await db.execute(
            select(Playthrough).where(
                Playthrough.user_id == user_id,
                Playthrough.project_id == project.id,
                Playthrough.is_completed == False
            ).order_by(Playthrough.started_at.desc()).limit(1)
        )
        active_playthrough = playthrough_query.scalars().first()

        project_dict = {
            'id': project.id,
            'title': project.title,
            'description': project.description,
            'cover_url': project.cover_url,
            'owner_id': project.owner_id,
            'is_published': project.is_published,
            'min_points': project.min_points,
            'reward_status': reward_status,
            'created_at': project.created_at,
            'updated_at': project.updated_at,
            'scenes_count': len(scenes),
            'scenes': [{
                'id': scene.id,
                'name': scene.name,
                'background_url': scene.background_url,
                'background_type': scene.background_type,
                'order_index': scene.order_index
            } for scene in scenes],
            'required_statuses': required_names,
            'groups': group_names,
            'has_active_playthrough': active_playthrough is not None
        }
        available_projects.append(project_dict)

    return available_projects


async def create_project(
    db: AsyncSession,
    project_data: schemas.ProjectCreate,
    owner_id: int
) -> models.Project:
    if not project_data.title:
        raise ProjectValidationError("Project title is required")

    reward_status_id = None
    if project_data.reward_status:
        status_query = await db.execute(
            select(Status).where(Status.name == project_data.reward_status)
        )
        status = status_query.scalar_one_or_none()
        
        if not status:
            status = Status(name=project_data.reward_status)
            db.add(status)
            await db.commit()
            await db.refresh(status)
        reward_status_id = status.id

    db_project = models.Project(
        title=project_data.title,
        description=project_data.description,
        min_points=project_data.min_points,
        reward_status_id=reward_status_id,
        owner_id=owner_id,
        is_published=False
    )
    
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)

    if project_data.required_statuses:
        for status_name in project_data.required_statuses:
            status_query = await db.execute(
                select(Status).where(Status.name == status_name)
            )
            status = status_query.scalar_one_or_none()
            if status:
                await add_required_status(db, db_project.id, status_name)

    if project_data.group_ids:
        for group_id in project_data.group_ids:
            group_query = await db.execute(
                select(Group).where(Group.id == group_id)
            )
            group = group_query.scalar_one_or_none()
            if group:
                await add_project_group(db, db_project.id, group_id)

    return await get_project(db, db_project.id)


async def update_project(
    db: AsyncSession,
    project_id: int,
    project_update: schemas.ProjectUpdate
) -> Optional[models.Project]:
    db_project = await get_project(db, project_id)
    if not db_project:
        raise ProjectNotFoundError()

    update_data = project_update.model_dump(exclude_unset=True)

    if 'reward_status' in update_data and update_data['reward_status']:
        status_query = await db.execute(
            select(Status).where(Status.name == update_data['reward_status'])
        )
        status = status_query.scalar_one_or_none()
        
        if not status:
            status = Status(name=update_data['reward_status'])
            db.add(status)
            await db.commit()
            await db.refresh(status)
        db_project.reward_status_id = status.id

    for field, value in update_data.items():
        if field in ['reward_status', 'required_statuses', 'group_ids']:
            continue
        if hasattr(db_project, field) and value is not None:
            setattr(db_project, field, value)

    if 'required_statuses' in update_data and update_data['required_statuses'] is not None:
        existing_query = await db.execute(
            select(models.ProjectRequiredStatus).where(
                models.ProjectRequiredStatus.project_id == project_id
            )
        )
        for link in existing_query.scalars().all():
            await db.delete(link)
        await db.flush()

        for status_name in update_data['required_statuses']:
            status_query = await db.execute(
                select(Status).where(Status.name == status_name)
            )
            status = status_query.scalar_one_or_none()
            if status:
                await add_required_status(db, project_id, status_name)

    if 'group_ids' in update_data and update_data['group_ids'] is not None:
        groups_query = await db.execute(
            select(models.ProjectGroup).where(
                models.ProjectGroup.project_id == project_id
            )
        )
        for link in groups_query.scalars().all():
            await db.delete(link)
        await db.flush()

        for group_id in update_data['group_ids']:
            group_query = await db.execute(
                select(Group).where(Group.id == group_id)
            )
            group = group_query.scalar_one_or_none()
            if group:
                await add_project_group(db, project_id, group_id)

    db_project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_project)
    
    return await get_project(db, project_id)


async def delete_project(db: AsyncSession, project_id: int) -> bool:
    db_project = await get_project(db, project_id)
    if not db_project:
        raise ProjectNotFoundError()

    await db.delete(db_project)
    await db.commit()
    return True


async def add_required_status(
    db: AsyncSession,
    project_id: int,
    status_name: str
) -> Optional[models.ProjectRequiredStatus]:
    status_query = await db.execute(
        select(Status).where(Status.name == status_name)
    )
    status = status_query.scalar_one_or_none()
    
    if not status:
        status = Status(name=status_name)
        db.add(status)
        await db.commit()
        await db.refresh(status)

    existing_query = await db.execute(
        select(models.ProjectRequiredStatus).where(
            models.ProjectRequiredStatus.project_id == project_id,
            models.ProjectRequiredStatus.status_id == status.id
        )
    )
    existing = existing_query.scalar_one_or_none()

    if existing:
        return existing

    required_status = models.ProjectRequiredStatus(
        project_id=project_id,
        status_id=status.id
    )
    db.add(required_status)
    await db.commit()
    await db.refresh(required_status)
    return required_status


async def add_project_group(
    db: AsyncSession,
    project_id: int,
    group_id: int
) -> Optional[models.ProjectGroup]:
    existing_query = await db.execute(
        select(models.ProjectGroup).where(
            models.ProjectGroup.project_id == project_id,
            models.ProjectGroup.group_id == group_id
        )
    )
    existing = existing_query.scalar_one_or_none()

    if existing:
        return existing

    project_group = models.ProjectGroup(
        project_id=project_id,
        group_id=group_id
    )
    db.add(project_group)
    await db.commit()
    await db.refresh(project_group)
    return project_group


async def get_project_groups(db: AsyncSession, project_id: int) -> List:
    groups_query = await db.execute(
        select(models.ProjectGroup).where(
            models.ProjectGroup.project_id == project_id
        )
    )
    group_links = groups_query.scalars().all()

    groups = []
    for link in group_links:
        group_query = await db.execute(
            select(Group).where(Group.id == link.group_id)
        )
        group = group_query.scalar_one_or_none()
        if group:
            groups.append(group)

    return groups


async def get_all_statuses(db: AsyncSession) -> List[dict]:
    query = await db.execute(select(Status).order_by(Status.name))
    statuses = query.scalars().all()
    return [{'id': s.id, 'name': s.name, 'description': s.description or ''} for s in statuses]


async def get_project_analytics(db: AsyncSession, project_id: int) -> dict:
    from src.playthroughs.models import Playthrough
    from src.users.models import User

    scenes = await scenes_crud.get_project_scenes(db, project_id)

    playthroughs_query = await db.execute(
        select(Playthrough).where(
            Playthrough.project_id == project_id,
            Playthrough.is_completed == True
        )
    )
    playthroughs = playthroughs_query.scalars().all()

    if not playthroughs:
        return {
            "total_playthroughs": 0,
            "total_students": 0,
            "average_points": 0,
            "max_points": 0,
            "leaderboard": [],
            "students_list": [],
            "scenes_map": {sc.id: {"id": sc.id, "name": sc.name, "order": sc.order_index} for sc in scenes}
        }

    student_playthroughs = {}
    for p in playthroughs:
        if p.user_id not in student_playthroughs:
            student_playthroughs[p.user_id] = []
        student_playthroughs[p.user_id].append(p)

    student_best = {}
    for user_id, user_playthroughs in student_playthroughs.items():
        best = max(user_playthroughs, key=lambda p: p.total_points)
        student_best[user_id] = best

    best_playthroughs = list(student_best.values())
    total_students = len(student_best)
    total_playthroughs = len(playthroughs)
    points_list = [p.total_points for p in best_playthroughs]
    average_points = sum(points_list) / len(points_list) if points_list else 0
    max_points = max(points_list) if points_list else 0

    leaderboard = []
    sorted_best = sorted(best_playthroughs, key=lambda p: p.total_points, reverse=True)

    for rank, p in enumerate(sorted_best[:10], 1):
        user_query = await db.execute(select(User).where(User.id == p.user_id))
        user = user_query.scalar_one_or_none()
        if user:
            leaderboard.append({
                "rank": rank,
                "student_name": f"{user.last_name} {user.first_name}",
                "student_email": user.email,
                "total_points": p.total_points,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
                "playthrough_id": p.id,
                "user_id": user.id,
                "attempts": len(student_playthroughs[p.user_id])
            })

    students_list = []
    for user_id, best in student_best.items():
        user_query = await db.execute(select(User).where(User.id == user_id))
        user = user_query.scalar_one_or_none()
        if user:
            students_list.append({
                "user_id": user.id,
                "student_name": f"{user.last_name} {user.first_name}",
                "student_email": user.email,
                "best_points": best.total_points,
                "attempts": len(student_playthroughs[user_id]),
                "last_playthrough_id": best.id,
                "last_completed_at": best.completed_at.isoformat() if best.completed_at else None
            })

    return {
        "total_playthroughs": total_playthroughs,
        "total_students": total_students,
        "average_points": round(average_points, 1),
        "max_points": max_points,
        "leaderboard": leaderboard,
        "students_list": students_list,
        "scenes_map": {sc.id: {"id": sc.id, "name": sc.name, "order": sc.order_index} for sc in scenes}
    }