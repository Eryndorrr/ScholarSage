from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class PaperBase(BaseModel):
    """论文基础模型"""
    title: Optional[str] = Field(None, max_length=500)
    authors: List[str] = Field(default_factory=list)
    abstract: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    publication_year: Optional[int] = None
    doi: Optional[str] = Field(None, max_length=100)
    venue: Optional[str] = Field(None, max_length=200)


class PaperCreate(PaperBase):
    """创建论文请求"""
    document_id: str


class PaperUpdate(BaseModel):
    """更新论文请求"""
    title: Optional[str] = Field(None, max_length=500)
    authors: Optional[List[str]] = None
    abstract: Optional[str] = None
    keywords: Optional[List[str]] = None
    publication_year: Optional[int] = None
    doi: Optional[str] = Field(None, max_length=100)
    venue: Optional[str] = Field(None, max_length=200)


class PaperResponse(PaperBase):
    """论文响应"""
    id: str
    document_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaperListResponse(BaseModel):
    """论文列表响应"""
    papers: List[PaperResponse]
    total: int
    page: Optional[int] = None
    page_size: Optional[int] = None
    total_pages: Optional[int] = None


class PaperWithCitationsResponse(PaperResponse):
    """带引用的论文详情响应"""
    citations_count: int = 0
