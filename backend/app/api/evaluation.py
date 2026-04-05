"""
RAG 评估 API
提供 RAG 系统效果评估的接口
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.evaluation import Evaluation, EvaluationStatus as ModelEvaluationStatus
from app.models.collection import Collection
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationResponse,
    EvaluationDetailResponse,
    EvaluationListResponse,
    EvaluationCompareRequest,
    EvaluationCompareResponse,
    EvaluationStatsResponse,
    EvaluationStatus
)
from app.core.evaluation.ragas_evaluator import get_evaluator
import logging
import math

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


def _clean_metrics(metrics: dict) -> dict:
    """清理 metrics 中的 NaN/Inf 值"""
    if not metrics:
        return metrics
    cleaned = {}
    for key, value in metrics.items():
        if value is not None:
            try:
                float_value = float(value)
                if math.isnan(float_value) or math.isinf(float_value):
                    cleaned[key] = None
                else:
                    cleaned[key] = float_value
            except (TypeError, ValueError):
                cleaned[key] = None
        else:
            cleaned[key] = None
    return cleaned


def _clean_detailed_results(results: list) -> list:
    """清理 detailed_results 中的 NaN/Inf 值"""
    if not results:
        return results
    cleaned = []
    for result in results:
        clean_result = {}
        for key, value in result.items():
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                clean_result[key] = None
            elif isinstance(value, dict):
                clean_result[key] = _clean_metrics(value)
            else:
                clean_result[key] = value
        cleaned.append(clean_result)
    return cleaned


def run_evaluation_task(
    evaluation_id: str,
    collection_id: str,
    questions: list,
    parameters: dict
):
    """后台任务：执行评估"""
    try:
        evaluator = get_evaluator()
        evaluator.run_evaluation(
            evaluation_id=evaluation_id,
            collection_name=collection_id,
            questions=questions,
            parameters=parameters
        )
        logger.info(f"Evaluation {evaluation_id} completed successfully")
    except Exception as e:
        logger.error(f"Evaluation {evaluation_id} failed: {e}")


@router.post("/run", response_model=EvaluationResponse)
def run_evaluation(
    request: EvaluationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    启动评估任务

    - 如果未提供 sample_questions，将自动生成评估问题
    - 评估在后台异步执行
    """
    # 验证知识库存在
    collection = db.query(Collection).filter(
        Collection.id == request.collection_id
    ).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # 获取或生成评估问题
    if request.sample_questions:
        questions = request.sample_questions
    else:
        # 自动生成问题
        evaluator = get_evaluator()
        questions = evaluator.generate_sample_questions(
            collection_name=request.collection_id,
            num_questions=request.sample_size or 5
        )

    if not questions:
        raise HTTPException(
            status_code=400,
            detail="No questions available for evaluation"
        )

    # 创建评估记录
    params = request.parameters.model_dump() if request.parameters else {}

    evaluation = Evaluation(
        collection_id=request.collection_id,
        status=ModelEvaluationStatus.PENDING,
        parameters=params,
        sample_questions=questions,
        total_questions=len(questions),
        processed_questions=0
    )

    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    # 启动后台评估任务
    background_tasks.add_task(
        run_evaluation_task,
        evaluation.id,
        request.collection_id,
        questions,
        params
    )

    logger.info(f"Started evaluation {evaluation.id} for collection {request.collection_id}")

    return _evaluation_to_response(evaluation)


@router.get("/{evaluation_id}", response_model=EvaluationDetailResponse)
def get_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db)
):
    """获取评估详情"""
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id
    ).first()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # 清理 metrics 和 detailed_results 中的 NaN 值
    metrics = _clean_metrics(evaluation.metrics)
    detailed_results = _clean_detailed_results(evaluation.detailed_results or [])

    return EvaluationDetailResponse(
        id=evaluation.id,
        collection_id=evaluation.collection_id,
        status=EvaluationStatus(evaluation.status.value),
        parameters=evaluation.parameters,
        sample_questions=evaluation.sample_questions,
        metrics=metrics,
        detailed_results=detailed_results,
        total_questions=evaluation.total_questions,
        processed_questions=evaluation.processed_questions,
        error_message=evaluation.error_message,
        created_at=evaluation.created_at,
        started_at=evaluation.started_at,
        completed_at=evaluation.completed_at,
        execution_time=evaluation.execution_time
    )


@router.get("/collection/{collection_id}", response_model=EvaluationListResponse)
def list_evaluations_by_collection(
    collection_id: str,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """获取指定知识库的评估列表"""
    query = db.query(Evaluation).filter(
        Evaluation.collection_id == collection_id
    )

    if status:
        try:
            status_enum = ModelEvaluationStatus(status)
            query = query.filter(Evaluation.status == status_enum)
        except ValueError:
            pass

    total = query.count()
    evaluations = query.order_by(
        Evaluation.created_at.desc()
    ).offset(offset).limit(limit).all()

    return EvaluationListResponse(
        evaluations=[_evaluation_to_response(e) for e in evaluations],
        total=total
    )


@router.get("/collection/{collection_id}/stats", response_model=EvaluationStatsResponse)
def get_collection_evaluation_stats(
    collection_id: str,
    db: Session = Depends(get_db)
):
    """获取知识库的评估统计"""
    evaluations = db.query(Evaluation).filter(
        Evaluation.collection_id == collection_id,
        Evaluation.status == ModelEvaluationStatus.COMPLETED
    ).all()

    if not evaluations:
        return EvaluationStatsResponse(total_evaluations=0)

    # 计算平均指标
    total_faithfulness = 0
    total_relevancy = 0
    total_precision = 0
    total_recall = 0
    count_faithfulness = 0
    count_relevancy = 0
    count_precision = 0
    count_recall = 0

    for e in evaluations:
        if e.metrics:
            if e.metrics.get("faithfulness") is not None:
                total_faithfulness += e.metrics["faithfulness"]
                count_faithfulness += 1
            if e.metrics.get("answer_relevancy") is not None:
                total_relevancy += e.metrics["answer_relevancy"]
                count_relevancy += 1
            if e.metrics.get("context_precision") is not None:
                total_precision += e.metrics["context_precision"]
                count_precision += 1
            if e.metrics.get("context_recall") is not None:
                total_recall += e.metrics["context_recall"]
                count_recall += 1

    # 找出最佳参数组合
    best_eval = max(
        [e for e in evaluations if e.metrics],
        key=lambda x: (
            (x.metrics.get("faithfulness") or 0) +
            (x.metrics.get("answer_relevancy") or 0)
        ) / 2,
        default=None
    )

    return EvaluationStatsResponse(
        total_evaluations=len(evaluations),
        avg_faithfulness=round(total_faithfulness / count_faithfulness, 4) if count_faithfulness > 0 else None,
        avg_answer_relevancy=round(total_relevancy / count_relevancy, 4) if count_relevancy > 0 else None,
        avg_context_precision=round(total_precision / count_precision, 4) if count_precision > 0 else None,
        avg_context_recall=round(total_recall / count_recall, 4) if count_recall > 0 else None,
        best_parameters=best_eval.parameters if best_eval else None
    )


@router.post("/compare", response_model=EvaluationCompareResponse)
def compare_evaluations(
    request: EvaluationCompareRequest,
    db: Session = Depends(get_db)
):
    """对比多个评估结果"""
    evaluations = db.query(Evaluation).filter(
        Evaluation.id.in_(request.evaluation_ids)
    ).all()

    if len(evaluations) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 evaluations are required for comparison"
        )

    comparisons = []
    for e in evaluations:
        comparisons.append({
            "id": e.id,
            "parameters": e.parameters,
            "metrics": e.metrics,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "execution_time": e.execution_time
        })

    return EvaluationCompareResponse(comparisons=comparisons)


@router.delete("/{evaluation_id}")
def delete_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db)
):
    """删除评估记录"""
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id
    ).first()

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    db.delete(evaluation)
    db.commit()

    return {"success": True, "message": "Evaluation deleted"}


def _evaluation_to_response(evaluation: Evaluation) -> EvaluationResponse:
    """将 Evaluation 模型转换为响应"""
    return EvaluationResponse(
        id=evaluation.id,
        collection_id=evaluation.collection_id,
        status=EvaluationStatus(evaluation.status.value),
        parameters=evaluation.parameters,
        sample_questions=evaluation.sample_questions,
        metrics=_clean_metrics(evaluation.metrics),
        total_questions=evaluation.total_questions,
        processed_questions=evaluation.processed_questions,
        error_message=evaluation.error_message,
        created_at=evaluation.created_at,
        started_at=evaluation.started_at,
        completed_at=evaluation.completed_at,
        execution_time=evaluation.execution_time
    )
