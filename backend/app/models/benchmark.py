"""QA 基准集数据模型"""
from sqlalchemy import Column, String, DateTime, Text, Integer, Float, Boolean, JSON
from sqlalchemy.sql import func
import uuid

from app.database import Base


class BenchmarkQA(Base):
    """QA 基准测试对"""
    __tablename__ = "benchmark_qa"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String, nullable=False, index=True)

    # 问题与标准答案
    question = Column(Text, nullable=False)
    gold_answer = Column(Text, nullable=False)

    # 关联的源文档片段
    gold_doc_ids = Column(JSON, default=list)  # 相关文档 ID 列表
    gold_contexts = Column(JSON, default=list)  # 相关文档内容片段

    # 元数据
    source = Column(String, default="auto")  # auto: LLM生成, manual: 人工标注, history: 查询历史回填
    difficulty = Column(String, default="medium")  # easy/medium/hard
    category = Column(String, nullable=True)  # 分类标签

    # 审核状态
    reviewed = Column(Boolean, default=False)  # 是否经过人工审核
    approved = Column(Boolean, default=True)  # 审核是否通过

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
