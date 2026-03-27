from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class CollectionBase(BaseModel):
    """知识库基础模型"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    color: str = Field(default="#1976d2", pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        """验证颜色格式"""
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("颜色必须是#RRGGBB格式")
        return v


class CollectionCreate(CollectionBase):
    """创建知识库请求"""
    pass


class CollectionUpdate(BaseModel):
    """更新知识库请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class CollectionResponse(CollectionBase):
    """知识库响应"""
    id: str
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True