"""
知识图谱 API
提供引用关系图谱和主题聚类数据
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import logging

from app.database import get_db
from app.models import Collection, Document, Paper, Citation
from app.core.graph.topic_cluster import get_topic_cluster

router = APIRouter(prefix="/api/graph", tags=["knowledge-graph"])
logger = logging.getLogger(__name__)


@router.get("/citation/{collection_id}")
def get_citation_graph(
    collection_id: str,
    include_external: bool = False,
    min_external_citations: int = 2,
    db: Session = Depends(get_db)
):
    """
    获取引用关系图谱数据

    Args:
        collection_id: 知识库 ID
        include_external: 是否包含外部参考文献（默认不包含）
        min_external_citations: 外部文献最少被引次数（仅当 include_external=True 时生效）

    Returns:
        图谱数据（节点 + 边）
        - 内部论文节点：type="internal"
        - 外部参考文献节点：type="external"（仅在 include_external=True 时返回）
        - 外部文献之间的引用关系：type="external_internal_cite"（高被引外部文献之间的引用）
    """
    # 验证 collection 存在
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 获取该 collection 下的所有论文
    papers = db.query(Paper).join(Document).filter(
        Document.collection_id == collection_id
    ).all()

    if not papers:
        return {"nodes": [], "edges": [], "external_refs_map": {}}

    # 构建内部论文节点
    nodes = []
    internal_paper_map = {}  # title_lower -> paper 用于匹配引用

    for paper in papers:
        # 获取该论文的引用数量（它引用了多少文献）
        outgoing_citations = db.query(Citation).filter(
            Citation.paper_id == paper.id
        ).all()

        # 获取该论文被引用次数（知识库内其他论文引用了它）
        incoming_citations = 0
        for p in papers:
            if p.id != paper.id:
                p_citations = db.query(Citation).filter(Citation.paper_id == p.id).all()
                for c in p_citations:
                    if c.cited_title and paper.title:
                        if c.cited_title.lower() in paper.title.lower() or paper.title.lower() in c.cited_title.lower():
                            incoming_citations += 1

        # 统计外部引用数
        external_cite_count = 0
        for c in outgoing_citations:
            if c.cited_title:
                is_internal = False
                for p in papers:
                    if p.title and (c.cited_title.lower() in p.title.lower() or p.title.lower() in c.cited_title.lower()):
                        is_internal = True
                        break
                if not is_internal:
                    external_cite_count += 1

        nodes.append({
            "id": paper.id,
            "title": paper.title or "未知标题",
            "authors": paper.authors or [],
            "year": paper.publication_year,
            "keywords": paper.keywords or [],
            "outgoing_citations": len(outgoing_citations),
            "incoming_citations": incoming_citations,
            "external_cite_count": external_cite_count,
            "doi": paper.doi,
            "type": "internal"
        })

        # 构建标题映射
        if paper.title:
            internal_paper_map[paper.title.lower()] = paper

    # 内部引用边
    edges = []

    for paper in papers:
        citations = db.query(Citation).filter(Citation.paper_id == paper.id).all()

        for citation in citations:
            cited_title = citation.cited_title
            if not cited_title:
                continue

            # 检查是否匹配内部论文
            matched_paper = None
            title_lower = cited_title.lower()

            for internal_title, internal_paper in internal_paper_map.items():
                if title_lower in internal_title or internal_title in title_lower:
                    matched_paper = internal_paper
                    break

            if matched_paper and matched_paper.id != paper.id:
                edges.append({
                    "source": paper.id,
                    "target": matched_paper.id,
                    "type": "internal_cite",
                    "location": citation.location
                })

    # 外部参考文献（仅在请求时返回）
    external_refs_map = {}  # paper_id -> [外部引用列表]
    external_nodes = []
    external_edges = []

    if include_external:
        external_refs = {}
        external_ref_counter = 0

        for paper in papers:
            citations = db.query(Citation).filter(Citation.paper_id == paper.id).all()
            paper_external_refs = []

            for citation in citations:
                cited_title = citation.cited_title
                cited_authors = citation.cited_authors or []
                cited_year = citation.cited_year

                if not cited_title:
                    continue

                # 检查是否是内部论文
                is_internal = False
                title_lower = cited_title.lower()

                for internal_title in internal_paper_map.keys():
                    if title_lower in internal_title or internal_title in title_lower:
                        is_internal = True
                        break

                if is_internal:
                    continue

                # 外部引用
                ref_key = cited_title.lower()[:100]

                if ref_key not in external_refs:
                    external_ref_counter += 1
                    external_id = f"external_{external_ref_counter}"
                    external_refs[ref_key] = {
                        "id": external_id,
                        "title": cited_title,
                        "authors": cited_authors,
                        "year": cited_year,
                        "doi": None,
                        "type": "external",
                        "outgoing_citations": 0,
                        "incoming_citations": 1,
                        "keywords": [],
                        "external_cite_count": 0
                    }
                else:
                    external_refs[ref_key]["incoming_citations"] += 1

                external_id = external_refs[ref_key]["id"]
                paper_external_refs.append(external_id)

                external_edges.append({
                    "source": paper.id,
                    "target": external_id,
                    "type": "external_cite",
                    "location": citation.location
                })

            external_refs_map[paper.id] = paper_external_refs

        # 过滤外部节点：只保留高被引的
        external_nodes = [
            ref for ref in external_refs.values()
            if ref["incoming_citations"] >= min_external_citations
        ]

        # 过滤边：只保留连接到高被引外部节点的边
        external_node_ids = {n["id"] for n in external_nodes}
        external_edges = [
            e for e in external_edges
            if e["target"] in external_node_ids
        ]

        # 更新 external_refs_map，只保留高被引的
        for paper_id in external_refs_map:
            external_refs_map[paper_id] = [
                ref_id for ref_id in external_refs_map[paper_id]
                if ref_id in external_node_ids
            ]

    # 合并节点和边
    all_nodes = nodes + external_nodes
    all_edges = edges + external_edges

    # 统计
    internal_edges = [e for e in edges if e["type"] == "internal_cite"]

    logger.info(f"Citation graph: {len(nodes)} internal nodes, {len(external_nodes)} external nodes (filtered >= {min_external_citations} citations), {len(internal_edges)} internal edges, {len(external_edges)} external edges")

    return {
        "nodes": all_nodes,
        "edges": all_edges,
        "external_refs_map": external_refs_map,
        "stats": {
            "total_papers": len(nodes),
            "external_references": len(external_nodes),
            "total_external_refs": len(external_refs) if include_external else 0,  # 总外部文献数
            "internal_citations": len(internal_edges),
            "external_citations": len(external_edges),
            "total_citations": len(all_edges)
        }
    }


@router.get("/citation/{collection_id}/external/{paper_id}")
def get_paper_external_refs(
    collection_id: str,
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    获取指定论文的外部引用文献（按需加载）

    Args:
        collection_id: 知识库 ID
        paper_id: 论文 ID

    Returns:
        外部引用文献列表
    """
    # 验证论文存在
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")

    # 获取知识库内的所有论文（用于判断是否是内部引用）
    papers = db.query(Paper).join(Document).filter(
        Document.collection_id == collection_id
    ).all()
    internal_titles = {p.title.lower() for p in papers if p.title}

    # 获取该论文的引用
    citations = db.query(Citation).filter(Citation.paper_id == paper_id).all()

    external_refs = []
    ref_counter = 0

    for citation in citations:
        cited_title = citation.cited_title
        if not cited_title:
            continue

        # 检查是否是内部论文
        is_internal = False
        title_lower = cited_title.lower()
        for internal_title in internal_titles:
            if title_lower in internal_title or internal_title in title_lower:
                is_internal = True
                break

        if is_internal:
            continue

        # 外部引用
        ref_counter += 1
        external_refs.append({
            "id": f"ext_{paper_id}_{ref_counter}",
            "title": cited_title,
            "authors": citation.cited_authors or [],
            "year": citation.cited_year,
            "venue": citation.cited_venue,
            "location": citation.location,
            "type": "external"
        })

    return {
        "paper_id": paper_id,
        "paper_title": paper.title,
        "external_refs": external_refs,
        "count": len(external_refs)
    }


@router.get("/topic-clusters/{collection_id}")
def get_topic_clusters(
    collection_id: str,
    db: Session = Depends(get_db)
):
    """
    获取主题聚类数据

    Args:
        collection_id: 知识库 ID

    Returns:
        聚类数据
    """
    # 验证 collection 存在
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 获取该 collection 下的所有论文
    papers = db.query(Paper).join(Document).filter(
        Document.collection_id == collection_id
    ).all()

    if not papers:
        return {"clusters": [], "top_keywords": []}

    # 执行聚类
    cluster = get_topic_cluster()
    clusters = cluster.cluster_papers(papers)

    # 获取热门关键词
    top_keywords = cluster.get_top_keywords(papers, top_n=20)

    # 构建节点详情映射
    paper_details = {}
    for p in papers:
        paper_details[p.id] = {
            "title": p.title or "未知标题",
            "authors": p.authors or [],
            "year": p.publication_year
        }

    # 为每个聚类添加论文详情
    for c in clusters:
        c["paper_details"] = [
            paper_details.get(pid, {"title": "未知", "authors": [], "year": None})
            for pid in c["papers"]
        ]

    logger.info(f"Topic clusters: {len(clusters)} clusters from {len(papers)} papers")

    return {
        "clusters": clusters,
        "top_keywords": top_keywords,
        "stats": {
            "total_papers": len(papers),
            "total_clusters": len(clusters),
            "total_keywords": len(top_keywords)
        }
    }


@router.get("/keywords/{collection_id}")
def get_keyword_network(
    collection_id: str,
    db: Session = Depends(get_db)
):
    """
    获取关键词共现网络

    Args:
        collection_id: 知识库 ID

    Returns:
        关键词网络数据
    """
    # 验证 collection 存在
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 获取该 collection 下的所有论文
    papers = db.query(Paper).join(Document).filter(
        Document.collection_id == collection_id
    ).all()

    if not papers:
        return {"nodes": [], "edges": []}

    # 计算共现
    cluster = get_topic_cluster()
    cooccurrence = cluster.get_keyword_cooccurrence(papers)
    top_keywords = cluster.get_top_keywords(papers, top_n=30)

    # 构建节点（只保留热门关键词）
    top_keyword_set = {kw["keyword"] for kw in top_keywords}
    nodes = [
        {
            "id": kw["keyword"],
            "name": kw["keyword"],
            "count": kw["count"],
            "papers": kw["papers"]
        }
        for kw in top_keywords
    ]

    # 构建边（只保留热门关键词之间的共现）
    edges = []
    seen_pairs = set()

    for kw1, neighbors in cooccurrence.items():
        if kw1 not in top_keyword_set:
            continue
        for kw2, count in neighbors.items():
            if kw2 not in top_keyword_set:
                continue

            # 避免重复边
            pair = tuple(sorted([kw1, kw2]))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)

            if count >= 1:  # 至少共现1次
                edges.append({
                    "source": kw1,
                    "target": kw2,
                    "weight": count
                })

    logger.info(f"Keyword network: {len(nodes)} nodes, {len(edges)} edges")

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_keywords": len(nodes),
            "total_connections": len(edges)
        }
    }


@router.get("/stats/{collection_id}")
def get_graph_stats(
    collection_id: str,
    db: Session = Depends(get_db)
):
    """
    获取知识图谱统计信息

    Args:
        collection_id: 知识库 ID

    Returns:
        统计数据
    """
    # 验证 collection 存在
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 统计论文数量
    paper_count = db.query(Paper).join(Document).filter(
        Document.collection_id == collection_id
    ).count()

    # 统计引用数量
    citation_count = db.query(Citation).join(Paper).join(Document).filter(
        Document.collection_id == collection_id
    ).count()

    # 统计关键词
    papers = db.query(Paper).join(Document).filter(
        Document.collection_id == collection_id
    ).all()

    all_keywords = set()
    for paper in papers:
        if paper.keywords:
            all_keywords.update(k.lower().strip() for k in paper.keywords if k)

    return {
        "paper_count": paper_count,
        "citation_count": citation_count,
        "keyword_count": len(all_keywords),
        "has_graph_data": paper_count > 0
    }
