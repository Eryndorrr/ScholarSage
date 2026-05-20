from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.rag.dialog_manager import DialogManager
from app.core.rag.generator import Generator
from app.core.rag.retriever import Retriever
from app.database import get_db
from app.models import Collection, QueryHistory
from app.models.user import User
from app.schemas import QueryRequest, QueryResponse
from app.services.rag_query_service import (
    RagQueryService,
    resolve_search_collections,
    result_relevance_score,
    retrieve_across_collections,
    verify_collection_access,
)

router = APIRouter(prefix="/api/query", tags=["query"])

# Backward-compatible names used by existing tests and callers inside this module.
_verify_collection_access = verify_collection_access
_resolve_search_collections = resolve_search_collections
_result_relevance_score = result_relevance_score
_retrieve_across_collections = retrieve_across_collections


@lru_cache()
def get_retriever() -> Retriever:
    """Get Retriever instance (singleton)."""
    return Retriever()


@lru_cache()
def get_generator() -> Generator:
    """Get Generator instance (singleton)."""
    return Generator()


@lru_cache()
def get_dialog_manager() -> DialogManager:
    """Get DialogManager instance (singleton)."""
    return DialogManager()


def get_rag_query_service(
    retriever: Retriever = Depends(get_retriever),
    generator: Generator = Depends(get_generator),
    dialog_manager: DialogManager = Depends(get_dialog_manager),
) -> RagQueryService:
    return RagQueryService(
        retriever=retriever,
        generator=generator,
        dialog_manager=dialog_manager,
    )


@router.post("/stream")
async def query_stream(
    request: QueryRequest,
    db: Session = Depends(get_db),
    service: RagQueryService = Depends(get_rag_query_service),
    current_user: User = Depends(get_current_user),
):
    """流式问答（支持中断）"""
    answer_generator, retrieval_context, response_time, session_context = await service.prepare_stream(
        request=request,
        db=db,
        current_user=current_user,
    )
    return StreamingResponse(
        service.sse_response(
            answer_generator,
            retrieval_context,
            response_time,
            db,
            request,
            session_context,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("", response_model=QueryResponse)
async def query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    service: RagQueryService = Depends(get_rag_query_service),
    current_user: User = Depends(get_current_user),
):
    """智能问答（支持多轮对话和联网检索）"""
    return await service.run(
        request=request,
        db=db,
        current_user=current_user,
    )


@router.get("/history/{collection_id}")
def get_query_history(
    collection_id: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取知识库的查询历史"""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    history = db.query(QueryHistory).filter(
        QueryHistory.collection_id == collection_id
    ).order_by(QueryHistory.query_time.desc()).limit(limit).all()

    return {
        "history": [
            {
                "id": item.id,
                "question": item.question,
                "answer": item.answer,
                "sources": item.sources,
                "confidence": item.confidence,
                "response_time": item.response_time,
                "query_time": item.query_time.isoformat(),
            }
            for item in history
        ],
        "total": len(history),
    }


@router.delete("/history/{history_id}")
def delete_query_history(
    history_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除单条查询历史"""
    history = db.query(QueryHistory).filter(QueryHistory.id == history_id).first()
    if not history:
        raise HTTPException(status_code=404, detail="查询历史不存在")

    db.delete(history)
    db.commit()
    return {"success": True, "message": "查询历史已删除"}


@router.delete("/history/collection/{collection_id}")
def clear_query_history(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """清空知识库的查询历史"""
    verify_collection_access(collection_id, current_user, db)
    deleted = db.query(QueryHistory).filter(
        QueryHistory.collection_id == collection_id
    ).delete()
    db.commit()
    return {"success": True, "deleted_count": deleted}
