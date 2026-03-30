from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import QueryRequest, QueryResponse
from app.models import QueryHistory, Collection
from app.core.rag.retriever import Retriever
from app.core.rag.generator import Generator
from functools import lru_cache
import time
import logging

logger = logging.getLogger(__name__)

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

    # 保存查询历史
    if request.collection_id:
        try:
            history = QueryHistory(
                collection_id=request.collection_id,
                question=request.question,
                answer=answer,
                sources=[s.model_dump() for s in sources],
                confidence=confidence,
                response_time=response_time
            )
            db.add(history)
            db.commit()
            logger.info(f"Query history saved: {request.question[:50]}...")
        except Exception as e:
            logger.error(f"Failed to save query history: {e}")
            db.rollback()

    return QueryResponse(
        answer=answer,
        sources=sources,
        confidence=confidence,
        response_time=response_time
    )


@router.get("/history/{collection_id}")
def get_query_history(
    collection_id: str,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """获取知识库的查询历史"""
    # 验证 collection 存在
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="知识库不存在")

    history = db.query(QueryHistory).filter(
        QueryHistory.collection_id == collection_id
    ).order_by(QueryHistory.query_time.desc()).limit(limit).all()

    return {
        "history": [
            {
                "id": h.id,
                "question": h.question,
                "answer": h.answer,
                "sources": h.sources,
                "confidence": h.confidence,
                "response_time": h.response_time,
                "query_time": h.query_time.isoformat()
            }
            for h in history
        ],
        "total": len(history)
    }


@router.delete("/history/{history_id}")
def delete_query_history(
    history_id: str,
    db: Session = Depends(get_db)
):
    """删除单条查询历史"""
    history = db.query(QueryHistory).filter(QueryHistory.id == history_id).first()
    if not history:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="查询历史不存在")

    db.delete(history)
    db.commit()
    return {"success": True, "message": "查询历史已删除"}


@router.delete("/history/collection/{collection_id}")
def clear_query_history(
    collection_id: str,
    db: Session = Depends(get_db)
):
    """清空知识库的查询历史"""
    deleted = db.query(QueryHistory).filter(
        QueryHistory.collection_id == collection_id
    ).delete()
    db.commit()
    return {"success": True, "deleted_count": deleted}
