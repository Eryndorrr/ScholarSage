from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SessionMessageBase(BaseModel):
    role: str
    content: str


class SessionMessageResponse(SessionMessageBase):
    id: str
    session_id: str
    sources: Optional[str] = None
    web_search_results: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionCreate(BaseModel):
    collection_id: str
    title: Optional[str] = None
    web_search_enabled: bool = False


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    web_search_enabled: Optional[bool] = None


class SessionResponse(BaseModel):
    id: str
    collection_id: str
    title: Optional[str]
    summary: Optional[str]
    message_count: int
    is_active: bool
    web_search_enabled: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionWithMessages(SessionResponse):
    messages: List[SessionMessageResponse] = []


class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]
    total: int
