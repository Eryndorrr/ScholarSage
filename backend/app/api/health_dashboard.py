"""
知识库健康度仪表盘 API
提供知识库的整体健康状态、统计数据和趋势信息
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import logging

from app.database import get_db
from app.models.collection import Collection
from app.models.document import Document
from app.models.evaluation import Evaluation, EvaluationStatus
from app.models.benchmark import BenchmarkQA
from app.models.query_history import QueryHistory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/collection/{collection_id}")
def get_collection_health(
    collection_id: str,
    db: Session = Depends(get_db)
):
    """获取单个知识库的健康度报告"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # 文档统计
    doc_total = db.query(func.count(Document.id)).filter(
        Document.collection_id == collection_id
    ).scalar() or 0

    doc_completed = db.query(func.count(Document.id)).filter(
        Document.collection_id == collection_id,
        Document.status == "completed"
    ).scalar() or 0

    doc_failed = db.query(func.count(Document.id)).filter(
        Document.collection_id == collection_id,
        Document.status == "failed"
    ).scalar() or 0

    doc_processing = db.query(func.count(Document.id)).filter(
        Document.collection_id == collection_id,
        Document.status.in_(["pending", "processing"])
    ).scalar() or 0

    # 查询历史统计
    query_total = db.query(func.count(QueryHistory.id)).filter(
        QueryHistory.collection_id == collection_id
    ).scalar() or 0

    # 平均置信度
    avg_confidence = db.query(func.avg(QueryHistory.confidence)).filter(
        QueryHistory.collection_id == collection_id
    ).scalar()

    # 平均响应时间
    avg_response_time = db.query(func.avg(QueryHistory.response_time)).filter(
        QueryHistory.collection_id == collection_id
    ).scalar()

    # 评估统计
    eval_completed = db.query(func.count(Evaluation.id)).filter(
        Evaluation.collection_id == collection_id,
        Evaluation.status == EvaluationStatus.COMPLETED
    ).scalar() or 0

    # 最近一次评估指标
    latest_eval = db.query(Evaluation).filter(
        Evaluation.collection_id == collection_id,
        Evaluation.status == EvaluationStatus.COMPLETED,
        Evaluation.metrics.isnot(None)
    ).order_by(Evaluation.completed_at.desc()).first()

    latest_metrics = {}
    if latest_eval and latest_eval.metrics:
        latest_metrics = {
            "faithfulness": latest_eval.metrics.get("faithfulness"),
            "answer_relevancy": latest_eval.metrics.get("answer_relevancy"),
            "context_precision": latest_eval.metrics.get("context_precision"),
            "evaluated_at": latest_eval.completed_at.isoformat() if latest_eval.completed_at else None
        }

    # 基准集统计
    benchmark_total = db.query(func.count(BenchmarkQA.id)).filter(
        BenchmarkQA.collection_id == collection_id
    ).scalar() or 0

    benchmark_reviewed = db.query(func.count(BenchmarkQA.id)).filter(
        BenchmarkQA.collection_id == collection_id,
        BenchmarkQA.reviewed == True  # noqa: E712
    ).scalar() or 0

    # 评估历史趋势（最近 10 次）
    recent_evals = db.query(Evaluation).filter(
        Evaluation.collection_id == collection_id,
        Evaluation.status == EvaluationStatus.COMPLETED,
        Evaluation.metrics.isnot(None)
    ).order_by(Evaluation.completed_at.desc()).limit(10).all()

    eval_trend = []
    for ev in reversed(recent_evals):
        if ev.metrics:
            eval_trend.append({
                "date": ev.completed_at.isoformat() if ev.completed_at else None,
                "faithfulness": ev.metrics.get("faithfulness"),
                "answer_relevancy": ev.metrics.get("answer_relevancy"),
                "context_precision": ev.metrics.get("context_precision"),
                "execution_time": ev.execution_time
            })

    # 计算健康度评分（0-100）
    health_score = _calculate_health_score(
        doc_total=doc_total,
        doc_completed=doc_completed,
        doc_failed=doc_failed,
        avg_confidence=avg_confidence,
        latest_metrics=latest_metrics
    )

    return {
        "collection_id": collection_id,
        "collection_name": collection.name,
        "health_score": health_score,
        "documents": {
            "total": doc_total,
            "completed": doc_completed,
            "failed": doc_failed,
            "processing": doc_processing
        },
        "queries": {
            "total": query_total,
            "avg_confidence": round(avg_confidence, 3) if avg_confidence else None,
            "avg_response_time": round(avg_response_time, 2) if avg_response_time else None
        },
        "evaluation": {
            "total_evaluations": eval_completed,
            "latest_metrics": latest_metrics,
            "trend": eval_trend
        },
        "benchmark": {
            "total": benchmark_total,
            "reviewed": benchmark_reviewed
        }
    }


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    """获取系统整体概览"""
    collections = db.query(Collection).all()

    total_docs = 0
    total_queries = 0
    total_evals = 0
    collection_stats = []

    for col in collections:
        doc_count = db.query(func.count(Document.id)).filter(
            Document.collection_id == col.id
        ).scalar() or 0

        query_count = db.query(func.count(QueryHistory.id)).filter(
            QueryHistory.collection_id == col.id
        ).scalar() or 0

        eval_count = db.query(func.count(Evaluation.id)).filter(
            Evaluation.collection_id == col.id,
            Evaluation.status == EvaluationStatus.COMPLETED
        ).scalar() or 0

        total_docs += doc_count
        total_queries += query_count
        total_evals += eval_count

        collection_stats.append({
            "id": col.id,
            "name": col.name,
            "document_count": doc_count,
            "query_count": query_count,
            "eval_count": eval_count
        })

    return {
        "total_collections": len(collections),
        "total_documents": total_docs,
        "total_queries": total_queries,
        "total_evaluations": total_evals,
        "collections": collection_stats
    }


def _calculate_health_score(
    doc_total: int,
    doc_completed: int,
    doc_failed: int,
    avg_confidence: Optional[float],
    latest_metrics: dict
) -> int:
    """
    计算知识库健康度评分（0-100）

    权重：
    - 文档完整度 30%（已完成/总数）
    - 查询置信度 35%（平均置信度）
    - 评估质量 35%（最新评估分数均值）
    """
    # 文档完整度
    if doc_total > 0:
        doc_score = doc_completed / doc_total
        # 有失败文档扣分
        if doc_failed > 0:
            doc_score *= (1 - doc_failed / doc_total * 0.5)
    else:
        doc_score = 0.0

    # 置信度
    confidence_score = avg_confidence if avg_confidence else 0.5

    # 评估质量
    metrics_values = [v for v in latest_metrics.values() if isinstance(v, (int, float)) and v is not None]
    eval_score = sum(metrics_values) / len(metrics_values) if metrics_values else 0.5

    health = doc_score * 30 + confidence_score * 35 + eval_score * 35
    return min(100, max(0, round(health)))
