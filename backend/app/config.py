from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # OpenAI配置
    openai_api_key: str = "sk-dummy"  # 本地部署时可使用任意值
    openai_model: str = "gpt-3.5-turbo"
    openai_base_url: str = "https://api.openai.com/v1"  # 支持自定义API端点
    embedding_model: str = "text-embedding-ada-002"

    # RAGAS 评估专用配置（可选，默认使用 openai 配置）
    ragas_api_key: Optional[str] = None  # 评估用 API Key，默认使用 openai_api_key
    ragas_model: str = "gpt-3.5-turbo"  # 评估用模型
    ragas_base_url: Optional[str] = None  # 评估用 API 端点，默认使用 openai_base_url
    use_ragas_evaluation: bool = False  # 是否使用 RAGAS 评估（默认使用增强的备用方法）

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

    # Embedding配置
    embedding_batch_size: int = 100  # 每批API调用的文本数量
    embedding_max_workers: int = 3   # 并发API调用数

    # 混合检索配置
    use_hybrid_search: bool = True  # 是否使用混合检索（向量 + BM25）
    hybrid_alpha: float = 0.5  # 向量检索权重 (0-1)，BM25权重为 1-alpha

    # 重排序配置
    use_rerank: bool = True  # 是否使用重排序
    rerank_model: str = "BAAI/bge-reranker-v2-m3"  # 重排序模型
    rerank_api_key: Optional[str] = None  # 重排序 API Key，默认使用 openai_api_key
    rerank_base_url: Optional[str] = None  # 重排序 API 端点，默认使用 openai_base_url
    rerank_top_k: int = 20  # 重排序候选数量

    # 联网检索配置
    web_search_enabled: bool = False  # 全局开关，是否允许联网检索
    web_search_provider: str = "duckduckgo"  # 搜索引擎: duckduckgo, tavily
    tavily_api_key: Optional[str] = None  # Tavily API Key
    web_search_max_results: int = 5  # 每次搜索返回的最大结果数

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()