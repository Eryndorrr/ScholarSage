from sqlalchemy import Column, String, DateTime, JSON, Enum as SQLEnum, Text, Integer, Float
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class EvaluationStatus(str, enum.Enum):
    """评估状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Evaluation(Base):
    """RAG评估记录"""
    __tablename__ = "evaluations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String, nullable=False, index=True)

    # 评估状态
    status = Column(
        SQLEnum(EvaluationStatus),
        default=EvaluationStatus.PENDING,
        nullable=False
    )

    # 评估参数
    parameters = Column(JSON, default=dict)  # chunk_size, top_k, embedding_model 等

    # 评估用的问题列表
    sample_questions = Column(JSON, default=list)

    # 评估指标结果
    metrics = Column(JSON, default=dict)  # faithfulness, answer_relevancy 等

    # 详细结果（每个问题的评估结果）
    detailed_results = Column(JSON, default=list)

    # 统计信息
    total_questions = Column(Integer, default=0)
    processed_questions = Column(Integer, default=0)

    # 错误信息
    error_message = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # 执行时间（秒）
    execution_time = Column(Float, nullable=True)
