"""
Асинхронные маршруты для работы с пользователями.
Включает аутентификацию, регистрацию, управление профилем и администрирование.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from src.database import get_db
from src.users import crud, schemas
from src.logger import setup_logger

router = APIRouter(prefix="/users", tags=["users"])
logger = setup_logger(__name__)


async def get_current_user_from_token(
    request: Request,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Извлекает текущего пользователя из JWT access токена."""
    token = None

    if authorization:
        scheme, _, token = authorization.partition(' ')
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=401, detail="Неверная схема авторизации")

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Требуется токен авторизации")

    payload = crud.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Токен невалидный или истек")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Невалидный токен")

    user = await crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учётная запись не активирована")

    return user


class RoleChecker:
    """Класс для проверки роли пользователя."""
    def __init__(self, roles: list):
        self.roles = roles

    async def __call__(self, current_user=Depends(get_current_user_from_token)):
        if current_user.role not in self.roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return current_user


@router.post("/login")
async def login(
    login_data: schemas.UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Вход в систему. Создает сессию с сохранением refresh токена в Redis."""
    logger.info(f"Попытка входа: {login_data.email}")

    if not login_data.email or not login_data.password:
        return JSONResponse(content={"success": False, "message": "Email и пароль обязательны"})

    user = await crud.authenticate_user(db, login_data.email, login_data.password)
    
    if not user:
        return JSONResponse(content={"success": False, "message": "Неверный email или пароль"})

    if not user.is_active:
        return JSONResponse(content={
            "success": False,
            "message": "Учётная запись не активирована. Ожидайте подтверждения администратором."
        })

    user_data = schemas.UserResponse.model_validate(user).model_dump(mode='json')

    response = JSONResponse(content={
        "success": True,
        "user": user_data,
        "message": "Вход выполнен успешно"
    })
    
    device_info = request.headers.get("user-agent", "unknown")[:200]
    ip_address = request.client.host if request.client else "unknown"
    
    await crud.create_session(user.id, response, device_info, ip_address)
    
    logger.info(f"Успешный вход: {user.email} (роль: {user.role})")
    return response


@router.post("/refresh")
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Обновляет сессию через refresh токен из Redis."""
    refresh_token_value = request.cookies.get("refresh_token")
    
    if not refresh_token_value:
        raise HTTPException(status_code=401, detail="Refresh токен отсутствует")

    response = JSONResponse(content={"success": True, "message": "Токены обновлены"})
    
    device_info = request.headers.get("user-agent", "unknown")[:200]
    ip_address = request.client.host if request.client else "unknown"
    
    access_token = await crud.refresh_session(refresh_token_value, response, device_info, ip_address)
    
    if not access_token:
        crud.clear_token_cookies(response)
        raise HTTPException(status_code=401, detail="Сессия истекла. Требуется повторный вход.")
    
    return response


@router.post("/logout")
async def logout(request: Request):
    """Выход из системы. Удаляет refresh токен из Redis."""
    refresh_token = request.cookies.get("refresh_token")
    
    if refresh_token:
        await crud.terminate_session(refresh_token)
    
    response = JSONResponse(content={"message": "Выход выполнен успешно"})
    crud.clear_token_cookies(response)
    logger.info("Пользователь вышел из системы")
    return response


@router.post("/logout/all")
async def logout_all(
    current_user=Depends(get_current_user_from_token)
):
    """Выход со всех устройств. Удаляет все refresh токены из Redis."""
    await crud.terminate_all_sessions(current_user.id)
    
    response = JSONResponse(content={"message": "Все сессии завершены"})
    crud.clear_token_cookies(response)
    
    logger.info(f"Все сессии пользователя {current_user.id} завершены")
    return response


@router.get("/sessions")
async def get_sessions(
    current_user=Depends(get_current_user_from_token)
):
    """Возвращает список активных сессий пользователя."""
    sessions = await crud.get_active_sessions(current_user.id)
    return {"sessions": sessions}


@router.post("/register")
async def register(
    user_data: schemas.UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """Регистрация нового пользователя."""
    logger.info(f"Регистрация нового пользователя: {user_data.email}")

    existing_user = await crud.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже зарегистрирован")

    try:
        new_user = await crud.create_user(db, user_data, is_active=False)
        return JSONResponse(content={
            "success": True,
            "message": "Регистрация успешна. Ожидайте подтверждения администратора.",
            "user_id": new_user.id
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user(
    current_user=Depends(get_current_user_from_token)
):
    """Возвращает данные текущего пользователя."""
    return current_user


@router.get("/me/statuses")
async def get_user_statuses(
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает статусы текущего пользователя."""
    return await crud.get_user_statuses(db, current_user.id)


@router.post("/change-password")
async def change_password(
    request: schemas.ChangePasswordRequest,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Смена пароля. Завершает все сессии пользователя."""
    if not request.old_password or not request.new_password:
        raise HTTPException(status_code=400, detail="Старый и новый пароли обязательны")

    if not crud.verify_password(request.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Неверный старый пароль")

    if len(request.new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 4 символов")

    await crud.update_user_password(db, current_user.id, request.new_password)
    
    response = JSONResponse(content={"message": "Пароль изменён. Все сессии завершены."})
    crud.clear_token_cookies(response)
    
    return response


@router.get("/groups", response_model=List[schemas.GroupResponse])
async def get_groups(
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает список всех групп."""
    groups = await crud.get_all_groups(db)
    return [schemas.GroupResponse.model_validate(g) for g in groups]


@router.post("/groups", response_model=schemas.GroupResponse)
async def create_group(
    group_data: schemas.GroupCreate,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Создает новую группу."""
    if not group_data.name or not group_data.name.strip():
        raise HTTPException(status_code=400, detail="Название группы обязательно")
    group = await crud.create_group(db, group_data.name.strip())
    return schemas.GroupResponse.model_validate(group)


@router.put("/groups/{group_id}", response_model=schemas.GroupResponse)
async def update_group(
    group_id: int,
    group_data: schemas.GroupUpdate,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Обновляет группу."""
    group = await crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    name = group_data.name.strip() if group_data.name else group.name
    updated = await crud.update_group(db, group_id, name)
    return schemas.GroupResponse.model_validate(updated)


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Удаляет группу."""
    group = await crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    await crud.delete_group(db, group_id)
    return {"message": "Группа удалена"}


@router.get("/admin/users", response_model=List[schemas.UserResponse])
async def get_all_users(
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Список всех пользователей."""
    users = await crud.get_all_users(db)
    return [schemas.UserResponse.model_validate(u) for u in users]


@router.post("/admin/users", response_model=schemas.UserResponse)
async def create_user_by_admin(
    user_data: schemas.UserCreateByAdmin,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Создание пользователя администратором."""
    if user_data.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Только супер-админ может создавать супер-админов")
    try:
        new_user = await crud.create_user(db, user_data, is_active=True)
        return schemas.UserResponse.model_validate(new_user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/users/{user_id}", response_model=schemas.UserResponse)
async def update_user_by_admin(
    user_id: int,
    user_update: schemas.AdminUpdateUserRequest,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Обновление данных пользователя администратором."""
    target_user = await crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target_user.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Нельзя изменить супер-админа")
    if user_update.role is not None and target_user.role == "super_admin":
        raise HTTPException(status_code=403, detail="Нельзя изменить роль супер-админа")
    if user_update.role is not None and user_update.role != "student":
        user_update.group_id = None

    update_data = user_update.model_dump(exclude_unset=True)
    updated = await crud.update_user(db, user_id, update_data)
    return schemas.UserResponse.model_validate(updated)


@router.put("/admin/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Активирует или деактивирует учётную запись. При деактивации завершает сессии."""
    target_user = await crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target_user.role == "super_admin":
        raise HTTPException(status_code=403, detail="Нельзя деактивировать супер-админа")

    new_state = not target_user.is_active
    await crud.toggle_user_active(db, user_id, new_state)

    return {
        "message": f"Пользователь {'активирован' if new_state else 'деактивирован'}",
        "is_active": new_state
    }


@router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    request: schemas.AdminResetPasswordRequest,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Сброс пароля. Завершает все сессии пользователя."""
    if not request.new_password or len(request.new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 4 символов")

    target_user = await crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target_user.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Нельзя сбросить пароль супер-админа")

    await crud.update_user_password(db, user_id, request.new_password)
    return {"message": "Пароль сброшен. Все сессии пользователя завершены."}


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user=Depends(RoleChecker(["admin", "super_admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Удаление пользователя."""
    if current_user.id == user_id:
        raise HTTPException(status_code=403, detail="Нельзя удалить самого себя")
    target_user = await crud.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target_user.role == "super_admin":
        raise HTTPException(status_code=403, detail="Нельзя удалить супер-админа")
    if current_user.role == "admin" and target_user.role == "admin":
        raise HTTPException(status_code=403, detail="Админ не может удалить другого админа")
    await crud.delete_user(db, user_id)
    return {"message": "Пользователь удалён"}


@router.get("/student/profile")
async def get_student_profile(
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Профиль студента с информацией о прохождениях."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только для студентов")

    from src.playthroughs.models import Playthrough
    from src.projects.models import Project

    group_name = None
    if current_user.group_id:
        group = await crud.get_group_by_id(db, current_user.group_id)
        if group:
            group_name = group.name

    playthroughs_query = await db.execute(select(Playthrough).where(Playthrough.user_id == current_user.id))
    playthroughs = playthroughs_query.scalars().all()

    project_stats = {}
    for p in playthroughs:
        if p.project_id not in project_stats:
            project_query = await db.execute(select(Project).where(Project.id == p.project_id))
            project = project_query.scalar_one_or_none()
            if project:
                project_stats[p.project_id] = {
                    "project_id": p.project_id,
                    "project_title": project.title,
                    "attempts": 0,
                    "best_points": 0,
                    "completed_attempts": 0,
                    "has_active": False,
                    "active_playthrough_id": None
                }
            else:
                continue

        stats = project_stats[p.project_id]
        stats["attempts"] += 1
        if p.is_completed:
            stats["completed_attempts"] += 1
            if p.total_points > stats["best_points"]:
                stats["best_points"] = p.total_points
        else:
            stats["has_active"] = True
            stats["active_playthrough_id"] = p.id

    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "last_name": current_user.last_name,
            "first_name": current_user.first_name,
            "patronymic": current_user.patronymic or "",
            "group_name": group_name,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        },
        "completed_projects": [s for s in project_stats.values() if s["completed_attempts"] > 0],
        "active_projects": [s for s in project_stats.values() if s["has_active"]]
    }


@router.get("/{user_id}", response_model=schemas.UserResponse)
async def get_user_by_id(
    user_id: int,
    current_user=Depends(get_current_user_from_token),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает пользователя по ID."""
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return schemas.UserResponse.model_validate(user)