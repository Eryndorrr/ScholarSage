from pydantic import BaseModel, Field
from typing import Optional, List


class CitationBase(BaseModel):
    """引用基础模型"""
    cited_title: Optional[str] = Field(None, max_length=500)
    cited_authors: Optional[List[str]] = Field(default_factory=list)
    cited_year: Optional[int] = None
    cited_venue: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=100)


class CitationCreate(CitationBase):
    """创建引用请求"""
    paper_id: str
    bibtex_raw: Optional[str] = None


class CitationResponse(CitationBase):
    """引用响应"""
    id: str
    paper_id: str
    bibtex_raw: Optional[str] = None

    class Config:
        from_attributes = True


class CitationListResponse(BaseModel):
    """引用列表响应"""
    citations: List[CitationResponse]
    total: int


class BibTeXExportRequest(BaseModel):
    """BibTeX导出请求"""
    paper_ids: List[str]


class BibTeXExportResponse(BaseModel):
    """BibTeX导出响应"""
    bibtex_entries: List[str]
