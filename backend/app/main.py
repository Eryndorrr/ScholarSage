from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.rate_limit import limiter
from app.database import engine, Base
from app.api import collections, documents, query, sessions, papers, evaluation, knowledge_graph, benchmark, health_dashboard, auth, admin
from app.core.monitoring import setup_monitoring
import os
import logging
import logging.config


def setup_logging():
    """配置日志 - 兼容 uvicorn reload 模式"""
    # 使用 dictConfig 确保所有日志配置一致
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            },
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "level": "INFO",
                "formatter": "default",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "app": {"level": "INFO", "handlers": ["default"], "propagate": False},
            "uvicorn": {"level": "INFO", "handlers": ["default"], "propagate": False},
            "uvicorn.access": {"level": "INFO", "handlers": ["default"], "propagate": False},
            "uvicorn.error": {"level": "INFO", "handlers": ["default"], "propagate": False},
        },
        "root": {
            "level": "INFO",
            "handlers": ["default"],
        },
    })


# 配置日志（模块加载时立即配置）
setup_logging()
logger = logging.getLogger(__name__)
logger.info("=== Module loading: main.py ===")

# 确保数据目录存在
os.makedirs("data", exist_ok=True)
os.makedirs("uploads", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时重新配置日志（覆盖 uvicorn 的设置）
    setup_logging()
    logger.info("Application started, logging configured")

    # JWT Secret 安全检查
    if settings.jwt_secret == "change-me-in-production-use-a-strong-random-string":
        logger.warning(
            "WARNING: JWT_SECRET is using the default value! "
            "Set JWT_SECRET environment variable to a strong random string."
        )

    yield
    # 关闭时清理
    logger.info("Application shutting down")


# 创建数据库表（仅作为开发环境的后备方案，生产环境请使用 alembic upgrade head）
try:
    from alembic.config import Config as AlembicConfig
    from alembic import command
    alembic_cfg = AlembicConfig("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    logger.info("Database migrated via Alembic")
except Exception as e:
    # Alembic 不可用时回退到 create_all（开发环境）
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database tables created (fallback): {e}")

# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    description="企业级RAG知识库系统",
    version="1.0.0",
    lifespan=lifespan
)

# 速率限制
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 安全头中间件
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# /metrics 端点保护（非 debug 模式需要 admin 认证）
@app.middleware("http")
async def metrics_auth_middleware(request: Request, call_next):
    if request.url.path == "/metrics" and not settings.debug:
        from jose import JWTError, jwt
        from app.models.user import User
        from app.database import SessionLocal

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=403, content={"detail": "需要管理员权限"})

        token = auth_header[7:]
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            user_id = payload.get("sub")
            if not user_id:
                return JSONResponse(status_code=403, content={"detail": "需要管理员权限"})
        except JWTError:
            return JSONResponse(status_code=403, content={"detail": "需要管理员权限"})

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
            if not user or not user.is_admin:
                return JSONResponse(status_code=403, content={"detail": "需要管理员权限"})
        finally:
            db.close()

    return await call_next(request)

# CORS配置（从 settings 读取）
cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

# 注册路由
app.include_router(collections.router)
app.include_router(documents.router)
app.include_router(query.router)
app.include_router(sessions.router)
app.include_router(papers.router)
app.include_router(evaluation.router)
app.include_router(knowledge_graph.router)
app.include_router(benchmark.router)
app.include_router(health_dashboard.router)
app.include_router(auth.router)
app.include_router(admin.router)
logger.info("API routes registered")


@app.get("/")
def root():
    """根路径"""
    return {
        "message": "RAG Knowledge Base API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy"}


# 初始化监控（必须在路由注册之后）
setup_monitoring(app)
