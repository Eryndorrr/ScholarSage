from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # OpenAI配置
    openai_api_key: str
    openai_model: str = "gpt-3.5-turbo"
    embedding_model: str = "text-embedding-ada-002"

    # 数据库配置
    database_url: str = "sqlite:///./data/knowledge.db"
    chroma_persist_dir: str = "./data/chroma"

    # 应用配置
    app_name: str = "RAG Knowledge Base"
    debug: bool = False

    # 文档处理配置
    chunk_size: int = 512
    chunk_overlap: int = 50
    top_k: int = 3

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()