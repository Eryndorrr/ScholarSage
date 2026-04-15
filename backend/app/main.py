from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api import collections, documents, query, sessions, papers, evaluation, knowledge_graph, benchmark, health_dashboard
from app.core.monitoring import setup_monitoring
import os
import logging
import sys

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# 确保数据目录存在
os.makedirs("data", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

# 创建数据库表
Base.metadata.create_all(bind=engine)
logger.info("Database tables created")

# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    description="企业级RAG知识库系统",
    version="1.0.0"
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