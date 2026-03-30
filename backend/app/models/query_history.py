from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
import uuid


class QueryHistory(Base):
    """查询历史模型"""
    __tablename__ = "query_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(JSON, default=list)  # [{"document_id": "...", "title": "...", "snippet": "..."}]
    confidence = Column(Float, default=0.0)
    response_time = Column(Float, default=0.0)  # 响应时间（秒）
    query_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # 关系
    collection = relationship("Collection", back_populates="query_history")

    def __repr__(self):
        return f"<QueryHistory {self.question[:50]}...>"
