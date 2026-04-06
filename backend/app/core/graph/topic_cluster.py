"""
主题聚类模块
基于论文关键词进行主题聚类
"""
import logging
from typing import List, Dict, Any, Optional
from collections import defaultdict
import math

from app.models.paper import Paper

logger = logging.getLogger(__name__)


class TopicCluster:
    """基于关键词的主题聚类器"""

    def __init__(self, min_cluster_size: int = 2, similarity_threshold: float = 0.3):
        """
        初始化聚类器

        Args:
            min_cluster_size: 最小聚类大小
            similarity_threshold: 相似度阈值
        """
        self.min_cluster_size = min_cluster_size
        self.similarity_threshold = similarity_threshold

    def cluster_papers(self, papers: List[Paper]) -> List[Dict[str, Any]]:
        """
        对论文进行主题聚类

        Args:
            papers: 论文列表

        Returns:
            聚类结果列表
        """
        if not papers:
            return []

        # 提取每篇论文的关键词
        paper_keywords = {}
        all_keywords = set()

        for paper in papers:
            keywords = paper.keywords or []
            # 标准化关键词（小写）
            normalized_keywords = [k.lower().strip() for k in keywords if k]
            paper_keywords[paper.id] = set(normalized_keywords)
            all_keywords.update(normalized_keywords)

        if not all_keywords:
            # 如果没有关键词，返回单个聚类
            return [{
                "id": "cluster_all",
                "name": "所有论文",
                "keywords": [],
                "papers": [p.id for p in papers],
                "paper_count": len(papers)
            }]

        # 计算论文间的相似度矩阵
        paper_ids = list(paper_keywords.keys())
        n = len(paper_ids)

        # 使用简化的聚类方法：基于关键词共现
        # 1. 构建关键词到论文的映射
        keyword_to_papers = defaultdict(set)
        for paper_id, keywords in paper_keywords.items():
            for kw in keywords:
                keyword_to_papers[kw].add(paper_id)

        # 2. 找出高频关键词作为聚类中心
        keyword_freq = {kw: len(papers) for kw, papers in keyword_to_papers.items()}
        # 按频率排序
        sorted_keywords = sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)

        # 3. 基于高频关键词创建聚类
        clusters = []
        assigned_papers = set()
        cluster_id = 0

        for keyword, freq in sorted_keywords:
            if freq < self.min_cluster_size:
                continue

            # 获取包含该关键词的论文
            cluster_papers = keyword_to_papers[keyword]

            # 过滤掉已分配的论文
            available_papers = cluster_papers - assigned_papers

            if len(available_papers) < self.min_cluster_size:
                continue

            # 创建聚类
            cluster_papers_list = list(available_papers)

            # 收集该聚类的所有关键词
            cluster_keywords = set()
            for pid in cluster_papers_list:
                cluster_keywords.update(paper_keywords[pid])

            # 找出聚类中最常见的关键词
            cluster_keyword_freq = defaultdict(int)
            for pid in cluster_papers_list:
                for kw in paper_keywords[pid]:
                    cluster_keyword_freq[kw] += 1

            # 按频率排序取前5个关键词
            top_keywords = sorted(cluster_keyword_freq.items(), key=lambda x: x[1], reverse=True)[:5]
            top_keyword_names = [kw for kw, _ in top_keywords]

            # 生成聚类名称
            cluster_name = self._generate_cluster_name(top_keyword_names)

            clusters.append({
                "id": f"cluster_{cluster_id}",
                "name": cluster_name,
                "keywords": top_keyword_names,
                "papers": cluster_papers_list,
                "paper_count": len(cluster_papers_list)
            })

            assigned_papers.update(available_papers)
            cluster_id += 1

        # 4. 处理未分配的论文
        unassigned_papers = set(paper_ids) - assigned_papers
        if unassigned_papers:
            # 将未分配的论文放入"其他"聚类
            unassigned_keywords = defaultdict(int)
            for pid in unassigned_papers:
                for kw in paper_keywords[pid]:
                    unassigned_keywords[kw] += 1

            top_unassigned = sorted(unassigned_keywords.items(), key=lambda x: x[1], reverse=True)[:5]
            top_unassigned_names = [kw for kw, _ in top_unassigned]

            clusters.append({
                "id": f"cluster_{cluster_id}",
                "name": "其他主题" if not top_unassigned_names else self._generate_cluster_name(top_unassigned_names),
                "keywords": top_unassigned_names,
                "papers": list(unassigned_papers),
                "paper_count": len(unassigned_papers)
            })

        # 按论文数量排序
        clusters.sort(key=lambda x: x["paper_count"], reverse=True)

        logger.info(f"Created {len(clusters)} clusters from {len(papers)} papers")
        return clusters

    def _generate_cluster_name(self, keywords: List[str]) -> str:
        """
        根据关键词生成聚类名称

        Args:
            keywords: 关键词列表

        Returns:
            聚类名称
        """
        if not keywords:
            return "未知主题"

        # 取前2个关键词组合
        if len(keywords) >= 2:
            return f"{keywords[0]} & {keywords[1]}"
        return keywords[0]

    def get_keyword_cooccurrence(self, papers: List[Paper]) -> Dict[str, Dict[str, int]]:
        """
        计算关键词共现矩阵

        Args:
            papers: 论文列表

        Returns:
            共现矩阵 {keyword1: {keyword2: count}}
        """
        cooccurrence = defaultdict(lambda: defaultdict(int))

        for paper in papers:
            keywords = paper.keywords or []
            normalized_keywords = list(set(k.lower().strip() for k in keywords if k))

            # 统计共现
            for i, kw1 in enumerate(normalized_keywords):
                for kw2 in normalized_keywords[i+1:]:
                    cooccurrence[kw1][kw2] += 1
                    cooccurrence[kw2][kw1] += 1

        return dict(cooccurrence)

    def get_top_keywords(self, papers: List[Paper], top_n: int = 20) -> List[Dict[str, Any]]:
        """
        获取出现频率最高的关键词

        Args:
            papers: 论文列表
            top_n: 返回数量

        Returns:
            关键词统计列表
        """
        keyword_freq = defaultdict(int)
        keyword_papers = defaultdict(list)

        for paper in papers:
            keywords = paper.keywords or []
            for kw in keywords:
                normalized = kw.lower().strip()
                if normalized:
                    keyword_freq[normalized] += 1
                    keyword_papers[normalized].append(paper.id)

        # 排序
        sorted_keywords = sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)[:top_n]

        return [
            {
                "keyword": kw,
                "count": count,
                "papers": keyword_papers[kw]
            }
            for kw, count in sorted_keywords
        ]


# 全局聚类器实例
_topic_cluster: Optional[TopicCluster] = None


def get_topic_cluster() -> TopicCluster:
    """获取聚类器单例"""
    global _topic_cluster
    if _topic_cluster is None:
        _topic_cluster = TopicCluster()
    return _topic_cluster
