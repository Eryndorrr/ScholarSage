from sqlalchemy import Column, String, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Chunk(Base):
    """文档切片模型"""
    __tablename__ = "chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    page_num = Column(Integer, default=0)
    position = Column(Integer, default=0)

    # 关系
    document = relationship("Document", back_populates="chunks")

    def __repr__(self):
        return f"<Chunk {self.id[:8]}...>"