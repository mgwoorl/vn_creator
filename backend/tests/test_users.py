"""
Тесты для модуля пользователей.
"""
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session

from src.users import crud, schemas, models
from src.users.exceptions import (
    UserNotFoundError, EmailAlreadyExistsError, 
    UserValidationError, InvalidRoleError
)


class TestUserCRUD:
    """Тесты CRUD операций для пользователей."""
    
    def test_create_user_success(self, db_session, sample_user_data):
        """Успешное создание пользователя."""
        user_data = schemas.UserCreate(**sample_user_data)
        user = crud.create_user(db_session, user_data)
        
        assert user.email == sample_user_data["email"]
        assert user.last_name == sample_user_data["last_name"]
        assert user.first_name == sample_user_data["first_name"]
        assert user.role == "student"
        assert user.password != sample_user_data["password"]  # Хеширован
    
    def test_create_user_duplicate_email(self, db_session, sample_user_data):
        """Ошибка при создании пользователя с существующим email."""
        user_data = schemas.UserCreate(**sample_user_data)
        crud.create_user(db_session, user_data)
        
        with pytest.raises(EmailAlreadyExistsError):
            crud.create_user(db_session, user_data)
    
    def test_create_user_invalid_role(self, db_session, sample_user_data):
        """Ошибка при создании пользователя с невалидной ролью."""
        user_data = schemas.UserCreate(**{**sample_user_data, "role": "invalid"})
        
        with pytest.raises(InvalidRoleError):
            crud.create_user(db_session, user_data)
    
    def test_create_user_short_password(self, db_session, sample_user_data):
        """Ошибка при создании пользователя с коротким паролем."""
        user_data = schemas.UserCreate(**{**sample_user_data, "password": "ab"})
        
        with pytest.raises(UserValidationError):
            crud.create_user(db_session, user_data)
    
    def test_get_user_by_email(self, db_session, sample_user_data):
        """Получение пользователя по email."""
        user_data = schemas.UserCreate(**sample_user_data)
        created = crud.create_user(db_session, user_data)
        
        found = crud.get_user_by_email(db_session, sample_user_data["email"])
        
        assert found is not None
        assert found.id == created.id
        assert found.email == sample_user_data["email"]
    
    def test_get_user_by_email_not_found(self, db_session):
        """Получение несуществующего пользователя."""
        found = crud.get_user_by_email(db_session, "nonexistent@example.com")
        assert found is None
    
    def test_get_user_by_id(self, db_session, sample_user_data):
        """Получение пользователя по ID."""
        user_data = schemas.UserCreate(**sample_user_data)
        created = crud.create_user(db_session, user_data)
        
        found = crud.get_user_by_id(db_session, created.id)
        
        assert found is not None
        assert found.email == sample_user_data["email"]
    
    def test_get_all_users(self, db_session, sample_user_data):
        """Получение всех пользователей."""
        user_data = schemas.UserCreate(**sample_user_data)
        crud.create_user(db_session, user_data)
        
        user_data2 = schemas.UserCreate(**{
            **sample_user_data, 
            "email": "test2@example.com"
        })
        crud.create_user(db_session, user_data2)
        
        all_users = crud.get_all_users(db_session)
        assert len(all_users) == 2
    
    def test_authenticate_user_success(self, db_session, sample_user_data):
        """Успешная аутентификация."""
        user_data = schemas.UserCreate(**sample_user_data)
        crud.create_user(db_session, user_data)
        
        user = crud.authenticate_user(
            db_session, 
            sample_user_data["email"], 
            sample_user_data["password"]
        )
        
        assert user is not None
        assert user.email == sample_user_data["email"]
    
    def test_authenticate_user_wrong_password(self, db_session, sample_user_data):
        """Ошибка аутентификации с неверным паролем."""
        user_data = schemas.UserCreate(**sample_user_data)
        crud.create_user(db_session, user_data)
        
        user = crud.authenticate_user(
            db_session, 
            sample_user_data["email"], 
            "wrongpassword"
        )
        
        assert user is None
    
    def test_authenticate_user_not_found(self, db_session):
        """Ошибка аутентификации несуществующего пользователя."""
        user = crud.authenticate_user(
            db_session, 
            "nonexistent@example.com", 
            "password"
        )
        
        assert user is None
    
    def test_delete_user(self, db_session, sample_user_data):
        """Удаление пользователя."""
        user_data = schemas.UserCreate(**sample_user_data)
        created = crud.create_user(db_session, user_data)
        
        result = crud.delete_user(db_session, created.id)
        
        assert result is True
        assert crud.get_user_by_id(db_session, created.id) is None
    
    def test_is_super_admin_exists(self, db_session):
        """Проверка существования супер-админа."""
        assert crud.is_super_admin_exists(db_session) is False
        
        # Создаем супер-админа
        admin_data = schemas.UserCreate(
            email="admin@example.com",
            last_name="Admin",
            first_name="Super",
            password="admin1234",
            role="super_admin"
        )
        crud.create_user(db_session, admin_data)
        
        assert crud.is_super_admin_exists(db_session) is True


class TestPasswordHashing:
    """Тесты хеширования паролей."""
    
    def test_hash_password(self):
        """Хеширование пароля."""
        password = "test1234"
        hashed = crud.get_password_hash(password)
        
        assert hashed != password
        assert len(hashed) > 0
    
    def test_verify_password(self):
        """Верификация пароля."""
        password = "test1234"
        hashed = crud.get_password_hash(password)
        
        assert crud.verify_password(password, hashed) is True
        assert crud.verify_password("wrong", hashed) is False
    
    def test_verify_password_empty(self):
        """Верификация пустого пароля."""
        hashed = crud.get_password_hash("test1234")
        
        assert crud.verify_password("", hashed) is False
        assert crud.verify_password("test1234", "") is False


class TestTokenManagement:
    """Тесты управления токенами."""
    
    def test_create_access_token(self):
        """Создание токена доступа."""
        data = {"user_id": 1, "email": "test@example.com"}
        token = crud.create_access_token(data)
        
        assert token is not None
        assert len(token) > 0
    
    def test_decode_access_token(self):
        """Декодирование токена."""
        data = {"user_id": 1, "email": "test@example.com"}
        token = crud.create_access_token(data)
        
        decoded = crud.decode_access_token(token)
        
        assert decoded is not None
        assert decoded["user_id"] == 1
        assert decoded["email"] == "test@example.com"
    
    def test_decode_invalid_token(self):
        """Декодирование невалидного токена."""
        decoded = crud.decode_access_token("invalid_token")
        assert decoded is None
    
    def test_token_expiry(self):
        """Проверка истечения токена."""
        from datetime import timedelta
        
        data = {"user_id": 1}
        # Токен с отрицательным сроком (уже истек)
        token = crud.create_access_token(data, timedelta(seconds=-1))
        
        decoded = crud.decode_access_token(token)
        assert decoded is None


class TestUserAPI:
    """Тесты API эндпоинтов пользователей."""
    
    def test_login_success(self, client, sample_user_data):
        """Успешный вход."""
        # Создаем пользователя через admin endpoint
        client.post("/users/admin/users", json=sample_user_data)
        
        response = client.post("/users/login", json={
            "email": sample_user_data["email"],
            "password": sample_user_data["password"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data
        assert data["user"]["email"] == sample_user_data["email"]
    
    def test_login_invalid_credentials(self, client):
        """Вход с неверными данными."""
        response = client.post("/users/login", json={
            "email": "wrong@example.com",
            "password": "wrong"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
    
    def test_get_current_user(self, client, auth_headers):
        """Получение текущего пользователя."""
        response = client.get("/users/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "role" in data
    
    def test_get_me_statuses(self, client, auth_headers):
        """Получение статусов текущего пользователя."""
        response = client.get("/users/me/statuses", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Должен быть статус "Стажёр"
        assert len(data) > 0