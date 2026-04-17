"""
论文管理 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Document, Paper, Citation, Collection
from app.models.user import User
from app.schemas import (
    PaperCreate, PaperUpdate, PaperResponse,
    PaperListResponse, PaperWithCitationsResponse,
    CitationCreate, CitationResponse, CitationListResponse,
    BibTeXExportRequest, BibTeXExportResponse
)
from app.core.parsers.paper_parser import PaperParser
from app.core.parsers.llm_paper_parser import LLMPaperParser
from app.core.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/papers", tags=["papers"])


def _verify_collection_owner(collection_id: str, current_user: User, db: Session):
    """验证知识库属于当前用户"""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


def _verify_document_owner(document_id: str, current_user: User, db: Session):
    """验证文档属于当前用户（通过 collection 间接验证）"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    _verify_collection_owner(document.collection_id, current_user, db)
    return document


@router.post("/parse", response_model=PaperResponse)
async def parse_paper(
    document_id: str,
    use_llm: bool = Query(False, description="是否使用 LLM 解析（更准确但需要 API 调用）"),
    force: bool = Query(False, description="是否强制重新解析（覆盖已有结果）"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    解析文档中的论文元数据

    Args:
        document_id: 文档 ID
        use_llm: 是否使用 LLM 解析（默认 False 使用规则解析，True 使用 LLM 更准确）
        force: 是否强制重新解析（默认 False，已有结果时直接返回）
    """
    # 查找文档并验证归属
    document = _verify_document_owner(document_id, current_user, db)

    # 检查是否已解析
    existing_paper = db.query(Paper).filter(Paper.document_id == document_id).first()
    if existing_paper and not force:
        return existing_paper

    # 如果强制重新解析，删除旧记录
    if existing_paper and force:
        # 先删除关联的引用
        db.query(Citation).filter(Citation.paper_id == existing_paper.id).delete()
        db.delete(existing_paper)
        db.flush()

    # 解析PDF
    if document.file_type != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported for paper parsing")

    try:
        if use_llm:
            # 使用 LLM 解析（更准确）
            logger.info(f"Using LLM parser for document {document_id}")
            parser = LLMPaperParser()
            metadata = parser.parse_paper_metadata(document.file_path)
            references = parser.extract_references(document.file_path)
        else:
            # 使用规则解析（更快，无需 API 调用）
            logger.info(f"Using rule-based parser for document {document_id}")
            parser = PaperParser(document.file_path)
            metadata = parser.parse_paper_metadata()
            references = parser.extract_references()
    except Exception as e:
        logger.error(f"Failed to parse paper: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse paper: {str(e)}")

    # 创建论文记录
    paper = Paper(
        document_id=document_id,
        title=metadata.get("title") or document.title,
        authors=metadata.get("authors", []),
        abstract=metadata.get("abstract"),
        keywords=metadata.get("keywords", []),
        publication_year=metadata.get("publication_year"),
        venue=metadata.get("venue"),
    )
    db.add(paper)
    db.flush()  # 获取paper.id

    # 创建引用记录
    for ref in references:
        citation = Citation(
            paper_id=paper.id,
            cited_title=ref.get("title"),
            cited_authors=ref.get("authors", []),
            cited_year=ref.get("year"),
            cited_venue=ref.get("venue"),
        )
        db.add(citation)

    db.commit()
    db.refresh(paper)

    return paper


@router.get("/by-document/{document_id}", response_model=PaperResponse)
def get_paper_by_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """通过文档ID获取论文信息"""
    _verify_document_owner(document_id, current_user, db)
    paper = db.query(Paper).filter(Paper.document_id == document_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@router.get("/{paper_id}", response_model=PaperWithCitationsResponse)
def get_paper(
    paper_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取论文详情（含引用数量）"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    citations_count = db.query(Citation).filter(Citation.paper_id == paper_id).count()

    return PaperWithCitationsResponse(
        id=paper.id,
        document_id=paper.document_id,
        title=paper.title,
        authors=paper.authors,
        abstract=paper.abstract,
        keywords=paper.keywords,
        publication_year=paper.publication_year,
        doi=paper.doi,
        venue=paper.venue,
        created_at=paper.created_at if hasattr(paper, 'created_at') else None,
        updated_at=paper.updated_at if hasattr(paper, 'updated_at') else None,
        citations_count=citations_count
    )


@router.put("/{paper_id}", response_model=PaperResponse)
def update_paper(
    paper_id: str,
    paper_update: PaperUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新论文元数据"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    update_data = paper_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(paper, key, value)

    db.commit()
    db.refresh(paper)
    return paper


@router.get("/{paper_id}/citations", response_model=CitationListResponse)
def get_paper_citations(
    paper_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取论文的引用列表"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    citations = db.query(Citation).filter(Citation.paper_id == paper_id).all()
    return CitationListResponse(citations=citations, total=len(citations))


@router.post("/generate-bibtex", response_model=BibTeXExportResponse)
def generate_bibtex(
    request: BibTeXExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """生成选定论文的BibTeX"""
    bibtex_entries = []

    for paper_id in request.paper_ids:
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if paper and paper.title:
            parser = PaperParser.__new__(PaperParser)
            bibtex = parser.generate_bibtex(
                title=paper.title,
                authors=paper.authors or [],
                year=paper.publication_year,
                venue=paper.venue,
                doi=paper.doi
            )
            bibtex_entries.append(bibtex)

    return BibTeXExportResponse(bibtex_entries=bibtex_entries)


@router.get("/collection/{collection_id}", response_model=PaperListResponse)
def list_papers_by_collection(
    collection_id: str,
    search: Optional[str] = Query(None, description="搜索关键词（标题、作者、摘要）"),
    year_from: Optional[int] = Query(None, description="起始年份"),
    year_to: Optional[int] = Query(None, description="结束年份"),
    venue: Optional[str] = Query(None, description="发表 venue 筛选"),
    sort_by: Optional[str] = Query("created_at", description="排序字段（created_at, publication_year, title）"),
    sort_order: Optional[str] = Query("desc", description="排序方向（asc, desc）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取知识库中的论文列表（支持搜索、过滤、排序、分页）

    Args:
        collection_id: 知识库 ID
        search: 搜索关键词（匹配标题、作者、摘要）
        year_from: 起始年份
        year_to: 结束年份
        venue: 发表 venue 筛选
        sort_by: 排序字段（created_at, publication_year, title）
        sort_order: 排序方向（asc, desc）
        page: 页码（从1开始）
        page_size: 每页数量（1-100）
    """
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # 基础查询
    query = (
        db.query(Paper)
        .join(Document)
        .filter(Document.collection_id == collection_id)
    )

    # 搜索过滤（标题、摘要）
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Paper.title.ilike(search_pattern)) |
            (Paper.abstract.ilike(search_pattern))
        )

    # 年份过滤
    if year_from is not None:
        query = query.filter(Paper.publication_year >= year_from)
    if year_to is not None:
        query = query.filter(Paper.publication_year <= year_to)

    # venue 过滤
    if venue:
        query = query.filter(Paper.venue.ilike(f"%{venue}%"))

    # 计算总数
    total = query.count()

    # 排序
    sort_column = {
        "created_at": Paper.created_at if hasattr(Paper, 'created_at') else Paper.id,
        "publication_year": Paper.publication_year,
        "title": Paper.title,
    }.get(sort_by, Paper.id)

    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 分页
    offset = (page - 1) * page_size
    papers = query.offset(offset).limit(page_size).all()

    # 计算总页数
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaperListResponse(
        papers=papers,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.delete("/{paper_id}")
def delete_paper(
    paper_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除论文（同时删除关联的引用）"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    db.delete(paper)
    db.commit()
    return {"success": True, "message": "Paper deleted"}
