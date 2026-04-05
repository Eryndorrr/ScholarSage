from sqlalchemy import Column, String, Integer, Text, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import uuid


class Paper(Base):
    """论文模型 - 存储论文专用元数据"""
    __tablename__ = "papers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), unique=True, nullable=False)
    title = Column(String(500), nullable=True)
    authors = Column(JSON, default=list)  # ["Author 1", "Author 2"]
    abstract = Column(Text, nullable=True)
    keywords = Column(JSON, default=list)  # ["keyword1", "keyword2"]
    publication_year = Column(Integer, nullable=True)
    doi = Column(String(100), nullable=True)
    venue = Column(String(200), nullable=True)  # 发表 venue (期刊/会议)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    document = relationship("Document", back_populates="paper")
    citations = relationship("Citation", back_populates="paper", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Paper {self.title}>"
