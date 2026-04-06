from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.document import SourceResponse


class QueryRequest(BaseModel):
    """查询请求"""
    question: str = Field(..., min_length=1, max_length=1000)
    collection_id: Optional[str] = None
    session_id: Optional[str] = None  # 会话ID（多轮对话）
    search_all: bool = False
    top_k: int = Field(default=3, ge=1, le=10)
    include_sources: bool = True
    use_hybrid: Optional[bool] = None  # 是否使用混合检索（默认使用配置）
    use_rerank: Optional[bool] = None  # 是否使用重排序（默认使用配置）


class QueryResponse(BaseModel):
    """查询响应"""
    answer: str
    sources: List[SourceResponse]
    confidence: float
    response_time: float