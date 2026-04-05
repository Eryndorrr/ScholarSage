from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EvaluationStatus(str, Enum):
    """评估状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class EvaluationParameters(BaseModel):
    """评估参数"""
    top_k: Optional[int] = Field(default=3, description="检索返回的文档数量")


class EvaluationMetrics(BaseModel):
    """评估指标"""
    faithfulness: Optional[float] = Field(None, ge=0, le=1, description="答案忠实度")
    answer_relevancy: Optional[float] = Field(None, ge=0, le=1, description="答案相关性")
    context_precision: Optional[float] = Field(None, ge=0, le=1, description="上下文精确度")
    context_recall: Optional[float] = Field(None, ge=0, le=1, description="上下文召回率")


class ContextSource(BaseModel):
    """上下文来源信息"""
    content: str = Field(..., description="内容片段")
    document_id: str = Field(default="", description="文档ID")
    document_name: str = Field(default="未知文档", description="文档名称")
    chunk_index: int = Field(default=-1, description="片段索引")
    page: Optional[int] = Field(default=None, description="页码")
    distance: float = Field(default=0, description="相似度距离")


class QuestionResult(BaseModel):
    """单个问题的评估结果"""
    question: str
    answer: str
    contexts: List[str]
    context_sources: Optional[List[ContextSource]] = Field(default=None, description="上下文来源信息")
    faithfulness: Optional[float] = None
    answer_relevancy: Optional[float] = None
    context_precision: Optional[float] = None
    context_recall: Optional[float] = None
    error: Optional[str] = None


# 请求模型
class EvaluationCreate(BaseModel):
    """创建评估请求"""
    collection_id: str
    sample_questions: Optional[List[str]] = Field(
        default=None,
        description="自定义评估问题列表，为空则自动生成"
    )
    parameters: Optional[EvaluationParameters] = Field(
        default_factory=EvaluationParameters,
        description="评估参数"
    )
    sample_size: Optional[int] = Field(
        default=5,
        ge=1,
        le=20,
        description="自动生成问题的数量"
    )


class EvaluationCompareRequest(BaseModel):
    """评估对比请求"""
    evaluation_ids: List[str] = Field(..., min_length=2, max_length=5)


# 响应模型
class EvaluationResponse(BaseModel):
    """评估响应"""
    id: str
    collection_id: str
    status: EvaluationStatus
    parameters: Dict[str, Any]
    sample_questions: List[str]
    metrics: Optional[Dict[str, Optional[float]]] = None
    total_questions: int
    processed_questions: int
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    execution_time: Optional[float] = None

    class Config:
        from_attributes = True


class EvaluationDetailResponse(EvaluationResponse):
    """评估详情响应（包含详细结果）"""
    detailed_results: List[QuestionResult]


class EvaluationListResponse(BaseModel):
    """评估列表响应"""
    evaluations: List[EvaluationResponse]
    total: int


class EvaluationCompareResponse(BaseModel):
    """评估对比响应"""
    comparisons: List[Dict[str, Any]]


class EvaluationStatsResponse(BaseModel):
    """评估统计响应"""
    total_evaluations: int
    avg_faithfulness: Optional[float] = None
    avg_answer_relevancy: Optional[float] = None
    avg_context_precision: Optional[float] = None
    avg_context_recall: Optional[float] = None
    best_parameters: Optional[Dict[str, Any]] = None
