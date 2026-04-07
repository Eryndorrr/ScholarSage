from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
import uuid


class Session(Base):
    """对话会话模型"""
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=True)  # 会话标题，可选
    summary = Column(Text, nullable=True)  # 对话摘要（压缩后的历史）
    message_count = Column(Integer, default=0)  # 消息数量
    is_active = Column(Boolean, default=True)  # 是否活跃
    web_search_enabled = Column(Boolean, default=False)  # 是否开启联网检索
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # 关系
    collection = relationship("Collection", back_populates="sessions")
    messages = relationship("SessionMessage", back_populates="session", cascade="all, delete-orphan", order_by="SessionMessage.created_at")

    def __repr__(self):
        return f"<Session {self.id[:8]}...>"


class SessionMessage(Base):
    """会话消息模型"""
    __tablename__ = "session_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' 或 'assistant'
    content = Column(Text, nullable=False)  # 消息内容
    sources = Column(Text, nullable=True)  # JSON格式的来源信息（仅assistant）
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # 关系
    session = relationship("Session", back_populates="messages")

    def __repr__(self):
        return f"<SessionMessage {self.role}: {self.content[:30]}...>"
