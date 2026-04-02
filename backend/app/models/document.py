from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
import uuid
import enum


class FileType(str, enum.Enum):
    """文件类型"""
    PDF = "pdf"
    DOCX = "docx"
    MD = "md"
    TXT = "txt"


class ProcessStatus(str, enum.Enum):
    """处理状态"""
    PENDING = "pending"      # 待处理
    PROCESSING = "processing"  # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"        # 失败


class Document(Base):
    """文档模型"""
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String, ForeignKey("collections.id"), nullable=False)
    title = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(SQLEnum(FileType), nullable=False)
    file_size = Column(Integer, default=0)
    status = Column(SQLEnum(ProcessStatus), default=ProcessStatus.PENDING)
    progress = Column(Integer, default=0)  # 处理进度 0-100
    chunk_count = Column(Integer, default=0)
    error_message = Column(String(500), nullable=True)
    upload_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # 关系
    collection = relationship("Collection", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Document {self.title}>"