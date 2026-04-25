from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api import collections, documents, query, sessions, papers, evaluation, knowledge_graph, benchmark, health_dashboard, auth, admin
from app.core.monitoring import setup_monitoring
import os
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

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
