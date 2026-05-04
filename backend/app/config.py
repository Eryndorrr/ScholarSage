from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # OpenAI配置
    openai_api_key: str = "sk-dummy"  # 本地部署时可使用任意值
    openai_model: str = "gpt-3.5-turbo"
    openai_base_url: str = "https://api.openai.com/v1"  # 支持自定义API端点
    embedding_model: str = "text-embedding-ada-002"

    # LLM 可靠性配置
    llm_fallback_models: str = ""  # 备用模型列表，逗号分隔，如 "gpt-4,gpt-3.5-turbo-16k"
    llm_max_retries: int = 3  # 最大重试次数
    llm_retry_delay: float = 1.0  # 初始重试延迟（秒）
    llm_retry_multiplier: float = 2.0  # 重试延迟倍数（指数退避）
    llm_timeout: int = 60  # API 请求超时时间（秒）

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
    web_search_provider: str = "duckduckgo"  # 搜索引擎: duckduckgo, tavily, bocha
    tavily_api_key: Optional[str] = None  # Tavily API Key
    bocha_api_key: Optional[str] = None  # Bocha API Key
    web_search_max_results: int = 5  # 每次搜索返回的最大结果数
    web_search_proxy: Optional[str] = None  # 代理设置，如 "http://127.0.0.1:7890"

    # 检索相关性配置
    min_relevance_score: float = 0.3  # 最低相关性分数阈值，低于此值视为无相关内容

    # 查询扩展配置
    query_expansion_enabled: bool = False  # 是否启用查询扩展
    query_expansion_hyde: bool = False  # HyDE：用假设答案替代原始查询做向量检索
    query_expansion_keywords: bool = True  # 关键词提取：增强 BM25 检索
    query_expansion_synonyms: bool = True  # 同义词扩展：扩大检索覆盖面

    # Redis / 任务队列配置
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None
    task_max_retries: int = 3  # 文档处理最大重试次数
    task_retry_delay: int = 30  # 重试间隔（秒）
    use_task_queue: bool = True  # 是否使用 arq 任务队列（False 则回退到 BackgroundTasks）

    # 安全配置
    max_upload_size: int = 100 * 1024 * 1024  # 最大上传文件大小（100MB）
    cors_origins: str = "http://localhost:5173,http://localhost:3000"  # 逗号分隔的 CORS 源
    rate_limit_per_minute: int = 60  # 全局 API 速率限制
    login_rate_limit_per_minute: int = 10  # 登录接口速率限制

    # JWT 认证配置
    jwt_secret: str = "change-me-in-production-use-a-strong-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()