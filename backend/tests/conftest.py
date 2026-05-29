"""
Фикстуры для тестирования backend.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.database import BaseDBModel, get_db
from src.main import app

# Тестовая база данных в памяти
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    """Создает таблицы перед каждым тестом и удаляет после."""
    BaseDBModel.metadata.create_all(bind=engine)
    yield
    BaseDBModel.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    """Тестовый клиент FastAPI."""
    return TestClient(app)

@pytest.fixture
def db_session():
    """Сессия базы данных для тестов."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def sample_user_data():
    """Пример данных пользователя."""
    return {
        "email": "test@example.com",
        "last_name": "Иванов",
        "first_name": "Иван",
        "patronymic": "Иванович",
        "password": "test1234",
        "role": "student"
    }

@pytest.fixture
def auth_token(client, sample_user_data):
    """Получает токен аутентификации для тестов."""
    # Создаем пользователя через API
    client.post("/users/admin/users", json=sample_user_data)
    
    # Логинимся
    response = client.post("/users/login", json={
        "email": sample_user_data["email"],
        "password": sample_user_data["password"]
    })
    
    return response.json()["access_token"]

@pytest.fixture
def auth_headers(auth_token):
    """Заголовки с токеном аутентификации."""
    return {"Authorization": f"Bearer {auth_token}"}