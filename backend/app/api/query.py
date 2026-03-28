from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import QueryRequest, QueryResponse
from app.core.rag.retriever import Retriever
from app.core.rag.generator import Generator
import time

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("", response_model=QueryResponse)
def query(request: QueryRequest, db: Session = Depends(get_db)):
    """智能问答"""
    start_time = time.time()

    # 初始化组件
    retriever = Retriever()
    generator = Generator()

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
    sources = [
        SourceResponse(
            document_id=r['metadata'].get('document_id', ''),
            title=r['metadata'].get('title', '未知文档'),
            page=r['metadata'].get('page', 0),
            snippet=r['content'][:200],
            relevance_score=1 - r['distance'],
            collection_name=r['metadata'].get('collection_name', '')
        )
        for r in results
    ]

    return QueryResponse(
        answer=answer,
        sources=sources,
        confidence=sum(1 - r['distance'] for r in results) / len(results) if results else 0,
        response_time=response_time
    )