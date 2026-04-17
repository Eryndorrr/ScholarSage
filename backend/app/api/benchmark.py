"""
QA 基准集管理和评估 API
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
import random
import logging

from app.database import get_db
from app.models.benchmark import BenchmarkQA
from app.models.collection import Collection
from app.models.user import User
from app.schemas.benchmark import (
    BenchmarkQACreate, BenchmarkQAResponse, BenchmarkQAListResponse,
    BenchmarkGenerateRequest, BenchmarkEvaluateRequest,
    BenchmarkEvaluateResponse, BenchmarkEvaluateResult,
    HallucinationDetectRequest, HallucinationDetectResponse,
    HallucinationClaimResponse
)
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])


def _verify_collection_owner(collection_id: str, current_user: User, db: Session):
    """验证知识库属于当前用户"""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


# ===== 基准集 CRUD =====

@router.post("", response_model=BenchmarkQAResponse)
def create_benchmark_qa(
    request: BenchmarkQACreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动创建基准 QA 对"""
    _verify_collection_owner(request.collection_id, current_user, db)
    qa = BenchmarkQA(
        collection_id=request.collection_id,
        question=request.question,
        gold_answer=request.gold_answer,
        gold_doc_ids=request.gold_doc_ids,
        gold_contexts=request.gold_contexts,
        difficulty=request.difficulty,
        category=request.category,
        source="manual",
        reviewed=True,
        approved=True
    )
    db.add(qa)
    db.commit()
    db.refresh(qa)
    return qa


@router.get("/collection/{collection_id}", response_model=BenchmarkQAListResponse)
def list_benchmarks(
    collection_id: str,
    source: Optional[str] = None,
    difficulty: Optional[str] = None,
    reviewed: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取知识库的基准 QA 列表"""
    _verify_collection_owner(collection_id, current_user, db)
    query = db.query(BenchmarkQA).filter(
        BenchmarkQA.collection_id == collection_id
    )

    if source:
        query = query.filter(BenchmarkQA.source == source)
    if difficulty:
        query = query.filter(BenchmarkQA.difficulty == difficulty)
    if reviewed is not None:
        query = query.filter(BenchmarkQA.reviewed == reviewed)

    total = query.count()
    items = query.order_by(BenchmarkQA.created_at.desc()).offset(offset).limit(limit).all()

    return BenchmarkQAListResponse(items=items, total=total)


@router.put("/{qa_id}/review")
def review_benchmark_qa(
    qa_id: str,
    approved: bool = True,
    question: Optional[str] = None,
    gold_answer: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """审核基准 QA（修改内容并标记审核通过/不通过）"""
    qa = db.query(BenchmarkQA).filter(BenchmarkQA.id == qa_id).first()
    if not qa:
        raise HTTPException(status_code=404, detail="Benchmark QA not found")

    if question:
        qa.question = question
    if gold_answer:
        qa.gold_answer = gold_answer
    qa.reviewed = True
    qa.approved = approved
    db.commit()

    return {"success": True, "message": "Review updated"}


@router.delete("/{qa_id}")
def delete_benchmark_qa(
    qa_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除基准 QA"""
    qa = db.query(BenchmarkQA).filter(BenchmarkQA.id == qa_id).first()
    if not qa:
        raise HTTPException(status_code=404, detail="Benchmark QA not found")

    db.delete(qa)
    db.commit()
    return {"success": True}


# ===== 自动生成 =====

@router.post("/generate", response_model=BenchmarkQAListResponse)
def generate_benchmarks(
    request: BenchmarkGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """从知识库文档自动生成基准 QA 对"""
    _verify_collection_owner(request.collection_id, current_user, db)

    from app.core.evaluation.benchmark_generator import BenchmarkGenerator
    generator = BenchmarkGenerator()

    # 从知识库生成 QA 对
    qa_list = generator.generate_from_collection(
        collection_name=request.collection_id,
        num_questions=request.num_questions
    )

    if not qa_list:
        raise HTTPException(status_code=400, detail="无法从知识库生成 QA 对，请检查知识库是否有文档")

    # 保存到数据库
    saved = []
    for qa in qa_list:
        record = BenchmarkQA(
            collection_id=request.collection_id,
            question=qa.question,
            gold_answer=qa.answer,
            gold_doc_ids=qa.doc_ids,
            gold_contexts=qa.contexts,
            source="auto",
            difficulty=qa.difficulty,
            category=qa.category,
            reviewed=False,
            approved=True
        )
        db.add(record)
        saved.append(record)

    db.commit()
    for record in saved:
        db.refresh(record)

    return BenchmarkQAListResponse(items=saved, total=len(saved))


# ===== 基准评估 =====

@router.post("/evaluate", response_model=BenchmarkEvaluateResponse)
def evaluate_with_benchmark(
    request: BenchmarkEvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """使用基准集评估系统表现"""
    _verify_collection_owner(request.collection_id, current_user, db)
    # 获取基准 QA
    query = db.query(BenchmarkQA).filter(
        BenchmarkQA.collection_id == request.collection_id,
        BenchmarkQA.approved == True
    )

    if request.benchmark_ids:
        query = query.filter(BenchmarkQA.id.in_(request.benchmark_ids))

    all_benchmarks = query.all()
    if not all_benchmarks:
        raise HTTPException(status_code=404, detail="No approved benchmark QA found")

    # 随机抽样
    benchmarks = random.sample(all_benchmarks, min(request.sample_size, len(all_benchmarks)))

    from app.core.rag.retriever import Retriever
    from app.core.rag.generator import Generator
    from app.core.evaluation.hallucination_detector import HallucinationDetector

    retriever = Retriever()
    generator = Generator()
    detector = HallucinationDetector()

    results = []
    faithfulness_scores = []
    similarity_scores = []
    hallucination_scores = []

    for bm in benchmarks:
        try:
            # 检索 + 生成
            docs = retriever.retrieve(
                query=bm.question,
                collection_name=bm.collection_id,
                top_k=3
            )
            contexts = [d['content'] for d in docs]
            answer = generator.generate_answer(
                question=bm.question,
                contexts=contexts
            )

            # 幻觉检测（quick 模式，减少延迟）
            hall_result = detector.detect(answer, contexts, detail_level="quick")
            hallucination_score = 1.0 - hall_result.overall_score

            # 答案相似度（简单比较：用 LLM 评分）
            similarity = _compute_similarity(bm.question, bm.gold_answer, answer)

            # 忠实度（从幻觉结果推导）
            faithfulness = hall_result.overall_score

            result = BenchmarkEvaluateResult(
                benchmark_id=bm.id,
                question=bm.question,
                gold_answer=bm.gold_answer[:200],
                system_answer=answer[:200],
                faithfulness=faithfulness,
                answer_similarity=similarity,
                hallucination_score=hallucination_score
            )
            results.append(result)

            if faithfulness is not None:
                faithfulness_scores.append(faithfulness)
            if similarity is not None:
                similarity_scores.append(similarity)
            if hallucination_score is not None:
                hallucination_scores.append(hallucination_score)

        except Exception as e:
            logger.error(f"Failed to evaluate benchmark {bm.id}: {e}")
            results.append(BenchmarkEvaluateResult(
                benchmark_id=bm.id,
                question=bm.question,
                gold_answer=bm.gold_answer[:200],
                system_answer="",
                faithfulness=None,
                answer_similarity=None,
                hallucination_score=None
            ))

    return BenchmarkEvaluateResponse(
        total_evaluated=len(results),
        avg_faithfulness=round(sum(faithfulness_scores) / len(faithfulness_scores), 3) if faithfulness_scores else None,
        avg_answer_similarity=round(sum(similarity_scores) / len(similarity_scores), 3) if similarity_scores else None,
        avg_hallucination_score=round(sum(hallucination_scores) / len(hallucination_scores), 3) if hallucination_scores else None,
        results=results
    )


def _compute_similarity(question: str, gold_answer: str, system_answer: str) -> float:
    """用 LLM 计算系统答案与标准答案的相似度"""
    try:
        from openai import OpenAI
        from app.config import settings
        import re

        client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=15
        )

        prompt = f"""比较以下两个答案的语义相似度。

问题：{question}

标准答案：{gold_answer[:500]}

系统答案：{system_answer[:500]}

评分标准：
1.0 - 系统答案与标准答案核心内容完全一致
0.8 - 大部分一致，有小差异
0.6 - 部分一致，有遗漏或多余信息
0.4 - 有一定关联但差异较大
0.2 - 仅少量相关
0.0 - 完全不同

只输出一个数字（0.0-1.0）。"""

        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=10,
            temperature=0
        )

        score_text = response.choices[0].message.content.strip()
        match = re.search(r'[\d.]+', score_text)
        if match:
            return min(1.0, max(0.0, float(match.group())))
        return 0.5

    except Exception as e:
        logger.warning(f"Similarity computation failed: {e}")
        return 0.5


# ===== 幻觉检测 =====

@router.post("/hallucination-detect", response_model=HallucinationDetectResponse)
def detect_hallucination(
    request: HallucinationDetectRequest,
    current_user: User = Depends(get_current_user),
):
    """检测答案中的幻觉"""
    from app.core.evaluation.hallucination_detector import HallucinationDetector

    detector = HallucinationDetector()
    result = detector.detect(
        answer=request.answer,
        contexts=request.contexts,
        detail_level=request.detail_level
    )

    return HallucinationDetectResponse(
        has_hallucination=result.has_hallucination,
        hallucination_ratio=result.hallucination_ratio,
        overall_score=result.overall_score,
        claims=[
            HallucinationClaimResponse(
                claim=c.claim,
                is_supported=c.is_supported,
                confidence=c.confidence,
                reasoning=c.reasoning
            )
            for c in result.claims
        ]
    )
