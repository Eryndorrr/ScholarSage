from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import QueryRequest, QueryResponse
from app.core.rag.retriever import Retriever
from app.core.rag.generator import Generator
from functools import lru_cache
import time

router = APIRouter(prefix="/api/query", tags=["query"])


@lru_cache()
def get_retriever() -> Retriever:
    """Get Retriever instance (singleton)"""
    return Retriever()


@lru_cache()
def get_generator() -> Generator:
    """Get Generator instance (singleton)"""
    return Generator()


@router.post("", response_model=QueryResponse)
def query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    retriever: Retriever = Depends(get_retriever),
    generator: Generator = Depends(get_generator)
):
    """智能问答"""
    start_time = time.time()

    # 检索相关文档
    collection_name = request.collection_id if not request.search_all else "all"
    results = retriever.retrieve(
        query=request.question,
        collection_name=collection_name,
        top_k=request.top_k
    )

    # 生成答案
    contexts = [r['content'] for r in results]
    answer = generator.generate_answer(
        question=request.question,
        contexts=contexts
    )

    # 计算响应时间
    response_time = time.time() - start_time

    # 构建来源响应
    from app.schemas.document import SourceResponse
    sources = []
    confidence_sum = 0.0
    for r in results:
        distance = r.get('distance')
        # 安全处理distance为None或不在有效范围的情况
        if distance is not None and 0 <= distance <= 1:
            relevance_score = 1 - distance
            confidence_sum += relevance_score
        else:
            relevance_score = 0.0
        sources.append(SourceResponse(
            document_id=r['metadata'].get('document_id', ''),
            title=r['metadata'].get('title', '未知文档'),
            page=r['metadata'].get('page', 0),
            snippet=r['content'][:200],
            relevance_score=relevance_score,
            collection_name=r['metadata'].get('collection_name', '')
        ))

    # 修复：安全计算置信度，避免除以零
    confidence = confidence_sum / len(results) if results else 0.0

    return QueryResponse(
        answer=answer,
        sources=sources,
        confidence=confidence,
        response_time=response_time
    )