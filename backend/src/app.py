"""
Основной файл приложения Visual Novel Builder.
"""
import asyncio
import sys
from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config import config
from src.logger import setup_logger
from src.database import init_db, close_db, AsyncSessionLocal
from src.redis_client import init_redis, close_redis
from src.users.router import router as users_router
from src.projects.router import router as projects_router
from src.scenes.router import router as scenes_router
from src.scenes.execution_router import router as scenes_execution_router
from src.playthroughs.router import router as playthroughs_router
from src.users import crud as users_crud

logger = setup_logger(__name__, 'app.log')

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup")
    await init_db()
    logger.info("Database tables created/verified")
    
    redis_ok = await init_redis()
    if not redis_ok:
        logger.warning("Redis unavailable. Session management disabled.")
    
    await bootstrap_super_admin()
    logger.info("Application started successfully")
    
    yield
    
    logger.info("Application shutdown")
    await close_redis()
    await close_db()


app = FastAPI(
    title="Visual Novel Builder API",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"→ {request.method} {request.url.path} → {response.status_code} ({duration:.3f}s)")
    return response


app.include_router(users_router)
app.include_router(projects_router)
app.include_router(scenes_router)
app.include_router(scenes_execution_router)
app.include_router(playthroughs_router)
logger.info("All routers registered")


@app.get("/")
async def root():
    return {"message": "Visual Novel Builder API", "status": "running"}


@app.get("/health")
async def health():
    redis_available = False
    try:
        from src.redis_client import redis_client
        redis_available = await redis_client.ping()
    except Exception:
        pass
    
    return {
        "status": "healthy",
        "database": "connected",
        "redis": "connected" if redis_available else "unavailable"
    }


async def bootstrap_super_admin():
    async with AsyncSessionLocal() as db:
        try:
            if await users_crud.is_super_admin_exists(db):
                return
            from src.users import schemas
            admin_data = schemas.UserCreateByAdmin(
                email=config.super_admin_email,
                password=config.super_admin_password,
                first_name=config.super_admin_first_name,
                last_name=config.super_admin_last_name,
                patronymic="",
                role="super_admin"
            )
            await users_crud.create_user(db, admin_data, is_active=True)
            logger.info("Super admin created")
        except Exception as e:
            logger.error(f"Failed: {e}")