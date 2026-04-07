from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import QueryRequest, QueryResponse, WebSearchSource
from app.models import QueryHistory, Collection, Session, SessionMessage
from app.core.rag.retriever import Retriever
from app.core.rag.generator import Generator
from app.core.rag.dialog_manager import DialogManager
from app.core.web_search import get_web_searcher
from app.config import settings
from functools import lru_cache
import time
import json
import logging
import asyncio
from typing import AsyncGenerator

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


@lru_cache()
def get_dialog_manager() -> DialogManager:
    """Get DialogManager instance (singleton)"""
    return DialogManager()


async def stream_response(
    answer_generator,
    sources,
    web_search_results,
    confidence,
    response_time,
    db: Session,
    request,
    session
) -> AsyncGenerator[str, None]:
    """
    流式生成响应，支持中断

    SSE 格式：
    data: {"type": "content", "text": "..."}
    data: {"type": "sources", "data": [...]}
    data: {"type": "done", "confidence": 0.8, "response_time": 1.5}
    """
    full_answer = ""

    try:
        async for chunk in answer_generator:
            full_answer += chunk
            yield f"data: {json.dumps({'type': 'content', 'text': chunk}, ensure_ascii=False)}\n\n"

        # 发送来源信息
        yield f"data: {json.dumps({'type': 'sources', 'data': [s.model_dump() for s in sources]}, ensure_ascii=False)}\n\n"

        # 发送网络搜索结果
        if web_search_results:
            yield f"data: {json.dumps({'type': 'web_results', 'data': [r.model_dump() for r in web_search_results]}, ensure_ascii=False)}\n\n"

        # 发送完成信号
        yield f"data: {json.dumps({'type': 'done', 'confidence': confidence, 'response_time': response_time}, ensure_ascii=False)}\n\n"

        # 保存到会话
        if request.session_id and session:
            # 保存用户消息
            user_msg = SessionMessage(
                session_id=session.id,
                role="user",
                content=request.question
            )
            db.add(user_msg)

            # 保存助手消息
            assistant_msg = SessionMessage(
                session_id=session.id,
                role="assistant",
                content=full_answer,
                sources=json.dumps([s.model_dump() for s in sources], ensure_ascii=False)
            )
            db.add(assistant_msg)

            # 更新会话统计
            session.message_count += 2
            db.commit()

    except asyncio.CancelledError:
        logger.info("Stream cancelled by client")
        yield f"data: {json.dumps({'type': 'cancelled'}, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def query_stream(
    request: QueryRequest,
    db: Session = Depends(get_db),
    retriever: Retriever = Depends(get_retriever),
    generator: Generator = Depends(get_generator),
    dialog_manager: DialogManager = Depends(get_dialog_manager)
):
    """流式问答（支持中断）"""
    start_time = time.time()

    # 获取或创建会话
    session = None
    history = []
    summary = None

    if request.session_id:
        session = db.query(Session).filter(Session.id == request.session_id).first()
        if session:
            messages = db.query(SessionMessage).filter(
                SessionMessage.session_id == session.id
            ).order_by(SessionMessage.created_at).all()
            history = [{"role": m.role, "content": m.content} for m in messages]
            summary = session.summary

    # 检索相关文档
    collection_name = request.collection_id if not request.search_all else "all"
    results = retriever.retrieve(
        query=request.question,
        collection_name=collection_name,
        top_k=request.top_k,
        use_hybrid=request.use_hybrid,
        use_rerank=request.use_rerank
    )

    contexts = [r['content'] for r in results]

    # 联网检索
    web_search_results = []
    web_context = ""

    should_web_search = request.web_search_enabled
    if not should_web_search and session and session.web_search_enabled:
        should_web_search = True

    if should_web_search and settings.web_search_enabled:
        try:
            web_searcher = get_web_searcher()
            if web_searcher.is_available():
                search_response = await web_searcher.search(request.question)
                if search_response.success:
                    web_context = web_searcher.format_results_for_context(search_response)
                    web_search_results = [
                        WebSearchSource(
                            title=r.title,
                            url=r.url,
                            snippet=r.snippet,
                            source=r.source
                        )
                        for r in search_response.results
                    ]
        except Exception as e:
            logger.error(f"Web search error: {e}")

    full_context = contexts
    if web_context:
        full_context = contexts + [web_context]

    # 构建来源响应
    from app.schemas.document import SourceResponse
    sources = []
    confidence_sum = 0.0
    for r in results:
        distance = r.get('distance')
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

    confidence = confidence_sum / len(results) if results else 0.0

    # 创建流式生成器
    async def answer_stream():
        """异步流式生成答案"""
        try:
            for chunk in generator.generate_answer_stream(
                question=request.question,
                contexts=full_context,
                history=history,
                summary=summary
            ):
                yield chunk
                await asyncio.sleep(0)  # 允许中断
        except Exception as e:
            logger.error(f"Stream generation error: {e}")
            raise

    response_time = time.time() - start_time

    return StreamingResponse(
        stream_response(
            answer_stream(),
            sources,
            web_search_results,
            confidence,
            response_time,
            db,
            request,
            session
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("", response_model=QueryResponse)
def query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    retriever: Retriever = Depends(get_retriever),
    generator: Generator = Depends(get_generator),
    dialog_manager: DialogManager = Depends(get_dialog_manager)
):
    """智能问答（支持多轮对话和联网检索）"""
    start_time = time.time()

    # 获取或创建会话
    session = None
    history = []
    summary = None

    if request.session_id:
        session = db.query(Session).filter(Session.id == request.session_id).first()
        if session:
            # 获取历史消息
            messages = db.query(SessionMessage).filter(
                SessionMessage.session_id == session.id
            ).order_by(SessionMessage.created_at).all()

            history = [{"role": m.role, "content": m.content} for m in messages]
            summary = session.summary

            logger.info(f"Session {session.id}: {len(history)} history messages, has_summary: {bool(summary)}")

    # 检索相关文档（支持混合检索和重排序）
    collection_name = request.collection_id if not request.search_all else "all"
    results = retriever.retrieve(
        query=request.question,
        collection_name=collection_name,
        top_k=request.top_k,
        use_hybrid=request.use_hybrid,
        use_rerank=request.use_rerank
    )

    # 准备上下文
    contexts = [r['content'] for r in results]

    # 联网检索
    web_search_results = []
    web_context = ""

    # 判断是否启用联网检索（请求参数 或 会话设置）
    should_web_search = request.web_search_enabled
    if not should_web_search and session and session.web_search_enabled:
        should_web_search = True

    if should_web_search and settings.web_search_enabled:
        try:
            web_searcher = get_web_searcher()
            if web_searcher.is_available():
                # 执行异步搜索
                search_response = asyncio.run(web_searcher.search(request.question))

                if search_response.success:
                    web_context = web_searcher.format_results_for_context(search_response)
                    web_search_results = [
                        WebSearchSource(
                            title=r.title,
                            url=r.url,
                            snippet=r.snippet,
                            source=r.source
                        )
                        for r in search_response.results
                    ]
                    logger.info(f"Web search returned {len(web_search_results)} results")
                else:
                    logger.warning(f"Web search failed: {search_response.error}")
        except Exception as e:
            logger.error(f"Web search error: {e}")

    # 合并上下文
    full_context = contexts
    if web_context:
        # 将网络搜索结果添加到上下文
        full_context = contexts + [web_context]

    # 生成答案（支持多轮上下文）
    answer = generator.generate_answer(
        question=request.question,
        contexts=full_context,
        history=history,
        summary=summary
    )

    # 计算响应时间
    response_time = time.time() - start_time

    # 构建来源响应
    from app.schemas.document import SourceResponse
    sources = []
    confidence_sum = 0.0
    for r in results:
        distance = r.get('distance')
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

    confidence = confidence_sum / len(results) if results else 0.0

    # 保存到会话
    if request.session_id and session:
        # 保存用户消息
        user_msg = SessionMessage(
            session_id=session.id,
            role="user",
            content=request.question
        )
        db.add(user_msg)

        # 保存助手消息
        assistant_msg = SessionMessage(
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=json.dumps([s.model_dump() for s in sources], ensure_ascii=False)
        )
        db.add(assistant_msg)

        # 更新会话统计
        session.message_count += 2

        # 检查是否需要生成摘要
        if dialog_manager.should_summarize(session.message_count, session.summary):
            # 获取所有消息用于摘要
            all_messages = db.query(SessionMessage).filter(
                SessionMessage.session_id == session.id
            ).order_by(SessionMessage.created_at).all()

            msg_list = [{"role": m.role, "content": m.content} for m in all_messages]
            session.summary = dialog_manager.generate_summary(msg_list)
            logger.info(f"Generated summary for session {session.id}")

        db.commit()

    # 保存查询历史（兼容旧版本）
    if request.collection_id:
        try:
            history_record = QueryHistory(
                collection_id=request.collection_id,
                question=request.question,
                answer=answer,
                sources=[s.model_dump() for s in sources],
                confidence=confidence,
                response_time=response_time
            )
            db.add(history_record)
            db.commit()
            logger.info(f"Query history saved: {request.question[:50]}...")
        except Exception as e:
            logger.error(f"Failed to save query history: {e}")
            db.rollback()

    return QueryResponse(
        answer=answer,
        sources=sources,
        confidence=confidence,
        response_time=response_time,
        web_search_results=web_search_results
    )


@router.get("/history/{collection_id}")
def get_query_history(
    collection_id: str,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """获取知识库的查询历史"""
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