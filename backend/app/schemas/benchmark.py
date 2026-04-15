"""QA 基准集和幻觉检测的 Schema"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ===== 基准集 Schema =====

class BenchmarkQACreate(BaseModel):
    """手动创建基准 QA"""
    collection_id: str
    question: str
    gold_answer: str
    gold_doc_ids: List[str] = Field(default_factory=list)
    gold_contexts: List[str] = Field(default_factory=list)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    category: Optional[str] = None


class BenchmarkQAResponse(BaseModel):
    """基准 QA 响应"""
    id: str
    collection_id: str
    question: str
    gold_answer: str
    gold_doc_ids: List[str]
    gold_contexts: List[str]
    source: str
    difficulty: str
    category: Optional[str]
    reviewed: bool
    approved: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BenchmarkQAListResponse(BaseModel):
    """基准 QA 列表"""
    items: List[BenchmarkQAResponse]
    total: int


class BenchmarkGenerateRequest(BaseModel):
    """自动生成基准 QA 请求"""
    collection_id: str
    num_questions: int = Field(default=10, ge=1, le=50)


class BenchmarkEvaluateRequest(BaseModel):
    """基于基准集跑评估请求"""
    collection_id: str
    benchmark_ids: Optional[List[str]] = Field(default=None, description="指定基准ID，为空则用全部")
    sample_size: int = Field(default=10, ge=1, le=50, description="随机抽样数量")


class BenchmarkEvaluateResult(BaseModel):
    """单个基准评估结果"""
    benchmark_id: str
    question: str
    gold_answer: str
    system_answer: str
    faithfulness: Optional[float] = None
    answer_similarity: Optional[float] = None
    hallucination_score: Optional[float] = None


class BenchmarkEvaluateResponse(BaseModel):
    """基准集评估结果"""
    total_evaluated: int
    avg_faithfulness: Optional[float] = None
    avg_answer_similarity: Optional[float] = None
    avg_hallucination_score: Optional[float] = None
    results: List[BenchmarkEvaluateResult]


# ===== 幻觉检测 Schema =====

class HallucinationDetectRequest(BaseModel):
    """幻觉检测请求"""
    answer: str
    contexts: List[str]
    detail_level: str = Field(default="full", pattern="^(full|quick)$")


class HallucinationClaimResponse(BaseModel):
    """单条陈述的幻觉检测结果"""
    claim: str
    is_supported: bool
    confidence: float
    reasoning: str


class HallucinationDetectResponse(BaseModel):
    """幻觉检测响应"""
    has_hallucination: bool
    hallucination_ratio: float
    overall_score: float
    claims: List[HallucinationClaimResponse] = []
