from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any


class SourceItem(BaseModel):
    """来源项"""
    document_id: str
    title: str
    snippet: str
    relevance_score: float


class QueryHistoryBase(BaseModel):
    """查询历史基础模型"""
    question: str = Field(..., min_length=1)
    answer: str
    sources: List[Any] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    response_time: float = Field(default=0.0, ge=0.0)


class QueryHistoryCreate(QueryHistoryBase):
    """创建查询历史请求"""
    collection_id: str


class QueryHistoryResponse(QueryHistoryBase):
    """查询历史响应"""
    id: str
    collection_id: str
    query_time: datetime

    class Config:
        from_attributes = True


class QueryHistoryListResponse(BaseModel):
    """查询历史列表响应"""
    history: List[QueryHistoryResponse]
    total: int
