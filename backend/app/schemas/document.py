from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.document import FileType, ProcessStatus


class DocumentBase(BaseModel):
    """文档基础模型"""
    title: str = Field(..., min_length=1, max_length=200)


class DocumentCreate(DocumentBase):
    """创建文档请求"""
    collection_id: str
    file_type: FileType


class DocumentResponse(DocumentBase):
    """文档响应"""
    id: str
    collection_id: str
    file_type: FileType
    file_size: int
    status: ProcessStatus
    chunk_count: int
    error_message: Optional[str] = None
    has_paper: bool = False  # 是否已解析为论文
    upload_time: datetime

    class Config:
        from_attributes = True


class SourceResponse(BaseModel):
    """来源响应"""
    document_id: str
    title: str
    page: int
    snippet: str
    relevance_score: float
    collection_name: str