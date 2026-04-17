from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
import uuid


class Collection(Base):
    """知识库模型"""
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    color = Column(String(7), default="#1976d2")
    document_count = Column(Integer, default=0)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # 关系
    documents = relationship("Document", back_populates="collection", cascade="all, delete-orphan")
    query_history = relationship("QueryHistory", back_populates="collection", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="collection", cascade="all, delete-orphan")
    owner = relationship("User", backref="collections")

    def __repr__(self):
        return f"<Collection {self.name}>"