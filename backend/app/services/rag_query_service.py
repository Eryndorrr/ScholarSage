import asyncio
import json
import logging
import time
from dataclasses import dataclass
from typing import AsyncGenerator, Iterable

from fastapi import HTTPException
from sqlalchemy.orm import Session as DbSession

from app.config import settings
from app.core.monitoring import (
    get_tracer,
    rag_retrieval_duration_seconds,
    record_rag_query,
)
from app.core.rag.dialog_manager import DialogManager
from app.core.rag.generator import Generator
from app.core.rag.retriever import Retriever
from app.core.web_search import get_web_searcher
from app.models import Collection, QueryHistory, Session, SessionMessage
from app.models.user import User
from app.schemas import QueryRequest, QueryResponse, WebSearchSource
from app.schemas.document import SourceResponse

logger = logging.getLogger(__name__)

NO_ANSWER_MESSAGE = "抱歉，在当前知识库中未找到与您的问题相关的内容。请尝试换个问法，或检查知识库中是否包含相关文档。"


@dataclass
class SessionContext:
    session: Session | None
    history: list[dict[str, str]]
    summary: str | None


@dataclass
class RetrievalContext:
    results: list[dict]
    contexts: list[str]
    web_search_results: list[WebSearchSource]
    web_context: str
    full_context: list[str]
    sources: list[SourceResponse]
    confidence: float
    retrieval_duration: float


def verify_collection_access(collection_id: str, current_user: User, db: DbSession) -> None:
    """Verify that a collection belongs to the current user."""
    if not collection_id:
        return
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")


def resolve_search_collections(
    request: QueryRequest,
    current_user: User,
    db: DbSession,
) -> list[Collection]:
    """Resolve the concrete collections that should be searched."""
    if request.search_all:
        return db.query(Collection).filter(
            Collection.user_id == current_user.id,
        ).order_by(Collection.created_at).all()

    if not request.collection_id:
        return []

    collection = db.query(Collection).filter(
        Collection.id == request.collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return [collection]


def result_relevance_score(result: dict) -> float:
    """Return a normalized relevance score for sorting/source confidence."""
    relevance_score = result.get("relevance_score")
    if relevance_score is not None:
        return max(0.0, min(1.0, float(relevance_score)))

    distance = result.get("distance")
    if distance is not None and 0 <= distance <= 1:
        return max(0.0, min(1.0, 1 - float(distance)))

    fusion_score = result.get("fusion_score")
    if fusion_score is not None:
        return max(0.0, float(fusion_score))

    return 0.0


def retrieve_across_collections(
    retriever: Retriever,
    question: str,
    collections: Iterable[Collection],
    top_k: int,
    use_hybrid: bool | None,
    use_rerank: bool | None,
) -> list[dict]:
    """Search one or more collections and return globally ranked results."""
    results: list[dict] = []
    for collection in collections:
        collection_results = retriever.retrieve(
            query=question,
            collection_name=collection.id,
            top_k=top_k,
            use_hybrid=use_hybrid,
            use_rerank=use_rerank,
        )
        for result in collection_results:
            enriched = result.copy()
            metadata = dict(enriched.get("metadata") or {})
            metadata.setdefault("collection_id", collection.id)
            metadata.setdefault("collection_name", collection.name)
            enriched["metadata"] = metadata
            enriched["relevance_score"] = result_relevance_score(enriched)
            results.append(enriched)

    return sorted(results, key=result_relevance_score, reverse=True)[:top_k]


class RagQueryService:
    """Coordinates RAG query execution independently of FastAPI route plumbing."""

    def __init__(
        self,
        retriever: Retriever,
        generator: Generator,
        dialog_manager: DialogManager,
    ):
        self.retriever = retriever
        self.generator = generator
        self.dialog_manager = dialog_manager

    def load_session_context(
        self,
        request: QueryRequest,
        db: DbSession,
        current_user: User,
    ) -> SessionContext:
        session = None
        history: list[dict[str, str]] = []
        summary = None

        if request.session_id:
            session = db.query(Session).join(Collection).filter(
                Session.id == request.session_id,
                Collection.user_id == current_user.id,
            ).first()
            if session:
                messages = db.query(SessionMessage).filter(
                    SessionMessage.session_id == session.id
                ).order_by(SessionMessage.created_at).all()
                history = [{"role": m.role, "content": m.content} for m in messages]
                summary = session.summary
                logger.info(
                    "Session %s: %s history messages, has_summary: %s",
                    session.id,
                    len(history),
                    bool(summary),
                )

        return SessionContext(session=session, history=history, summary=summary)

    def build_sources(self, results: list[dict]) -> tuple[list[SourceResponse], float]:
        sources = []
        confidence_sum = 0.0
        for result in results:
            metadata = result.get("metadata") or {}
            relevance_score = result_relevance_score(result)
            confidence_sum += relevance_score
            sources.append(SourceResponse(
                document_id=metadata.get("document_id", ""),
                title=metadata.get("title", "未知文档"),
                page=metadata.get("page", 0),
                snippet=result.get("content", "")[:200],
                relevance_score=relevance_score,
                collection_name=metadata.get("collection_name", ""),
            ))

        confidence = confidence_sum / len(results) if results else 0.0
        return sources, confidence

    def has_relevant_sources(self, sources: list[SourceResponse]) -> bool:
        return any(
            source.relevance_score >= settings.min_relevance_score
            for source in sources
        )

    async def search_web(
        self,
        request: QueryRequest,
        session_context: SessionContext,
    ) -> tuple[str, list[WebSearchSource]]:
        should_web_search = request.web_search_enabled
        if not should_web_search and session_context.session and session_context.session.web_search_enabled:
            should_web_search = True

        if not should_web_search or not settings.web_search_enabled:
            return "", []

        try:
            web_searcher = get_web_searcher()
            if not web_searcher.is_available():
                return "", []

            search_response = await web_searcher.search(request.question)
            if not search_response.success:
                logger.warning("Web search failed: %s", search_response.error)
                return "", []

            web_context = web_searcher.format_results_for_context(search_response)
            web_search_results = [
                WebSearchSource(
                    title=result.title,
                    url=result.url,
                    snippet=result.snippet,
                    source=result.source,
                )
                for result in search_response.results
            ]
            logger.info("Web search returned %s results", len(web_search_results))
            return web_context, web_search_results
        except Exception as exc:
            logger.error("Web search error: %s", exc)
            return "", []

    async def prepare_retrieval(
        self,
        request: QueryRequest,
        db: DbSession,
        current_user: User,
        session_context: SessionContext,
    ) -> RetrievalContext:
        collections = resolve_search_collections(request, current_user, db)
        tracer = get_tracer()

        retrieval_start = time.time()
        with tracer.start_as_current_span("retrieval") as span:
            span.set_attribute("query", request.question[:100])
            span.set_attribute("collections", ",".join(collection.id for collection in collections))
            results = retrieve_across_collections(
                retriever=self.retriever,
                question=request.question,
                collections=collections,
                top_k=request.top_k,
                use_hybrid=request.use_hybrid,
                use_rerank=request.use_rerank,
            )
            span.set_attribute("results_count", len(results))

        retrieval_duration = time.time() - retrieval_start
        rag_retrieval_duration_seconds.labels(
            use_hybrid=str(request.use_hybrid),
            use_rerank=str(request.use_rerank),
        ).observe(retrieval_duration)

        contexts = [result["content"] for result in results]
        web_context, web_search_results = await self.search_web(request, session_context)
        full_context = contexts + [web_context] if web_context else contexts
        sources, confidence = self.build_sources(results)

        return RetrievalContext(
            results=results,
            contexts=contexts,
            web_search_results=web_search_results,
            web_context=web_context,
            full_context=full_context,
            sources=sources,
            confidence=confidence,
            retrieval_duration=retrieval_duration,
        )

    def record_query(
        self,
        *,
        start_time: float,
        retrieval_context: RetrievalContext,
        request: QueryRequest,
        has_answer: bool,
        stream: bool,
        model: str | None = None,
    ) -> None:
        record_rag_query(
            duration=time.time() - start_time,
            has_web_search=bool(retrieval_context.web_search_results),
            has_answer=has_answer,
            confidence=retrieval_context.confidence if has_answer else 0.0,
            sources_count=len(retrieval_context.sources) if has_answer else 0,
            retrieval_duration=retrieval_context.retrieval_duration,
            model=model,
            use_hybrid=request.use_hybrid,
            use_rerank=request.use_rerank,
            stream=stream,
        )

    def save_session_messages(
        self,
        db: DbSession,
        request: QueryRequest,
        session_context: SessionContext,
        answer: str,
        sources: list[SourceResponse],
        web_search_results: list[WebSearchSource],
        summarize: bool = False,
    ) -> None:
        if not request.session_id or not session_context.session:
            return

        session = session_context.session
        db.add(SessionMessage(
            session_id=session.id,
            role="user",
            content=request.question,
        ))
        db.add(SessionMessage(
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=json.dumps([source.model_dump() for source in sources], ensure_ascii=False),
            web_search_results=json.dumps(
                [result.model_dump() for result in web_search_results],
                ensure_ascii=False,
            ) if web_search_results else None,
        ))

        session.message_count += 2

        if summarize and self.dialog_manager.should_summarize(session.message_count, session.summary):
            all_messages = db.query(SessionMessage).filter(
                SessionMessage.session_id == session.id
            ).order_by(SessionMessage.created_at).all()
            msg_list = [{"role": message.role, "content": message.content} for message in all_messages]
            session.summary = self.dialog_manager.generate_summary(msg_list)
            logger.info("Generated summary for session %s", session.id)

        db.commit()

    def save_query_history(
        self,
        db: DbSession,
        request: QueryRequest,
        answer: str,
        sources: list[SourceResponse],
        confidence: float,
        response_time: float,
    ) -> None:
        if not request.collection_id:
            return

        try:
            db.add(QueryHistory(
                collection_id=request.collection_id,
                question=request.question,
                answer=answer,
                sources=[source.model_dump() for source in sources],
                confidence=confidence,
                response_time=response_time,
            ))
            db.commit()
            logger.info("Query history saved: %s...", request.question[:50])
        except Exception as exc:
            logger.error("Failed to save query history: %s", exc)
            db.rollback()

    async def run(
        self,
        request: QueryRequest,
        db: DbSession,
        current_user: User,
    ) -> QueryResponse:
        start_time = time.time()
        session_context = self.load_session_context(request, db, current_user)
        retrieval_context = await self.prepare_retrieval(request, db, current_user, session_context)

        if not self.has_relevant_sources(retrieval_context.sources) and not retrieval_context.web_context:
            self.record_query(
                start_time=start_time,
                retrieval_context=retrieval_context,
                request=request,
                has_answer=False,
                stream=False,
            )
            return QueryResponse(
                answer=NO_ANSWER_MESSAGE,
                sources=retrieval_context.sources,
                confidence=0.0,
                response_time=time.time() - start_time,
                web_search_results=[],
            )

        tracer = get_tracer()
        with tracer.start_as_current_span("generation") as span:
            span.set_attribute("contexts_count", len(retrieval_context.full_context))
            span.set_attribute("web_contexts_count", len(retrieval_context.web_search_results))
            answer = self.generator.generate_answer(
                question=request.question,
                contexts=retrieval_context.full_context,
                history=session_context.history,
                summary=session_context.summary,
                web_contexts_count=len(retrieval_context.web_search_results),
            )
            span.set_attribute("answer_length", len(answer))

        response_time = time.time() - start_time
        self.save_session_messages(
            db,
            request,
            session_context,
            answer,
            retrieval_context.sources,
            retrieval_context.web_search_results,
            summarize=True,
        )
        self.save_query_history(
            db,
            request,
            answer,
            retrieval_context.sources,
            retrieval_context.confidence,
            response_time,
        )
        self.record_query(
            start_time=start_time,
            retrieval_context=retrieval_context,
            request=request,
            has_answer=True,
            stream=False,
            model=settings.openai_model,
        )

        return QueryResponse(
            answer=answer,
            sources=retrieval_context.sources,
            confidence=retrieval_context.confidence,
            response_time=response_time,
            web_search_results=retrieval_context.web_search_results,
        )

    async def answer_stream(
        self,
        request: QueryRequest,
        retrieval_context: RetrievalContext,
        session_context: SessionContext,
    ) -> AsyncGenerator[str, None]:
        try:
            for chunk in self.generator.generate_answer_stream(
                question=request.question,
                contexts=retrieval_context.full_context,
                history=session_context.history,
                summary=session_context.summary,
                web_contexts_count=len(retrieval_context.web_search_results),
            ):
                yield chunk
                await asyncio.sleep(0)
        except Exception as exc:
            logger.error("Stream generation error: %s", exc)
            raise

    async def sse_response(
        self,
        answer_generator: AsyncGenerator[str, None],
        retrieval_context: RetrievalContext,
        response_time: float,
        db: DbSession,
        request: QueryRequest,
        session_context: SessionContext,
    ) -> AsyncGenerator[str, None]:
        full_answer = ""

        try:
            async for chunk in answer_generator:
                full_answer += chunk
                yield f"data: {json.dumps({'type': 'content', 'text': chunk}, ensure_ascii=False)}\n\n"

            yield f"data: {json.dumps({'type': 'sources', 'data': [source.model_dump() for source in retrieval_context.sources]}, ensure_ascii=False)}\n\n"

            if retrieval_context.web_search_results:
                yield f"data: {json.dumps({'type': 'web_results', 'data': [result.model_dump() for result in retrieval_context.web_search_results]}, ensure_ascii=False)}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'confidence': retrieval_context.confidence, 'response_time': response_time}, ensure_ascii=False)}\n\n"

            self.save_session_messages(
                db,
                request,
                session_context,
                full_answer,
                retrieval_context.sources,
                retrieval_context.web_search_results,
            )
        except asyncio.CancelledError:
            logger.info("Stream cancelled by client")
            yield f"data: {json.dumps({'type': 'cancelled'}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.error("Stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n"

    async def prepare_stream(
        self,
        request: QueryRequest,
        db: DbSession,
        current_user: User,
    ) -> tuple[AsyncGenerator[str, None], RetrievalContext, float, SessionContext]:
        start_time = time.time()
        session_context = self.load_session_context(request, db, current_user)
        retrieval_context = await self.prepare_retrieval(request, db, current_user, session_context)

        if not self.has_relevant_sources(retrieval_context.sources) and not retrieval_context.web_context:
            self.record_query(
                start_time=start_time,
                retrieval_context=retrieval_context,
                request=request,
                has_answer=False,
                stream=True,
            )

            async def no_result_stream() -> AsyncGenerator[str, None]:
                yield NO_ANSWER_MESSAGE

            return no_result_stream(), retrieval_context, time.time() - start_time, session_context

        response_time = time.time() - start_time
        self.record_query(
            start_time=start_time,
            retrieval_context=retrieval_context,
            request=request,
            has_answer=True,
            stream=True,
            model=settings.openai_model,
        )
        return self.answer_stream(request, retrieval_context, session_context), retrieval_context, response_time, session_context
