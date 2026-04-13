"""
查询扩展模块

提供三种策略提升检索召回率：
1. HyDE - 生成假设答案用于向量检索
2. 关键词提取 - 提取核心词增强 BM25
3. 同义词扩展 - 扩展查询词覆盖面
"""
import logging
import re
from typing import List, Optional, Tuple
from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class QueryExpander:
    """查询扩展器"""

    def __init__(self):
        self._client: Optional[OpenAI] = None

    def _get_client(self) -> OpenAI:
        """延迟初始化 OpenAI 客户端"""
        if self._client is None:
            self._client = OpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
                timeout=30
            )
        return self._client

    def expand_query(
        self,
        query: str,
        use_hyde: bool = False,
        use_keywords: bool = False,
        use_synonyms: bool = False
    ) -> Tuple[str, Optional[str]]:
        """
        查询扩展主入口

        Args:
            query: 原始查询
            use_hyde: 是否使用 HyDE
            use_keywords: 是否提取关键词
            use_synonyms: 是否同义词扩展

        Returns:
            (检索用文本, BM25 增强关键词或 None)
            - 检索用文本：原始 query 或 HyDE 生成的假设答案
            - BM25 增强关键词：原始 query + 提取的关键词 + 同义词
        """
        retrieval_text = query
        bm25_text = None

        # HyDE：生成假设答案用于向量检索
        if use_hyde:
            retrieval_text = self._generate_hypothetical_answer(query)

        # BM25 增强
        if use_keywords or use_synonyms:
            parts = [query]

            if use_keywords:
                keywords = self._extract_keywords(query)
                if keywords:
                    parts.append(" ".join(keywords))

            if use_synonyms:
                synonyms = self._expand_synonyms(query)
                if synonyms:
                    parts.append(" ".join(synonyms))

            bm25_text = " ".join(parts)

        return retrieval_text, bm25_text

    def _generate_hypothetical_answer(self, query: str) -> str:
        """
        HyDE：生成假设答案

        用假设答案替代原始查询去做向量检索，
        因为假设答案在语义空间中更接近真实文档。

        Args:
            query: 用户原始问题

        Returns:
            假设答案文本
        """
        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "请针对用户的问题，写一段详细的回答（200-300字）。"
                            "不需要完全准确，但要包含相关的专业术语和概念。"
                            "直接输出回答内容，不要加前缀说明。"
                        )
                    },
                    {"role": "user", "content": query}
                ],
                max_tokens=400,
                temperature=0.3
            )
            hypothetical_answer = response.choices[0].message.content.strip()
            logger.info(f"HyDE generated {len(hypothetical_answer)} chars for query: {query[:50]}")
            return hypothetical_answer

        except Exception as e:
            logger.warning(f"HyDE generation failed, falling back to original query: {e}")
            return query

    def _extract_keywords(self, query: str) -> List[str]:
        """
        从查询中提取关键词

        Args:
            query: 用户查询

        Returns:
            关键词列表
        """
        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "从用户的问题中提取3-5个核心关键词。"
                            "只输出关键词，用空格分隔，不要其他内容。"
                        )
                    },
                    {"role": "user", "content": query}
                ],
                max_tokens=50,
                temperature=0.1
            )
            keywords_text = response.choices[0].message.content.strip()
            keywords = keywords_text.split()
            # 过滤过短或无效的词
            keywords = [k for k in keywords if len(k) > 1]
            logger.info(f"Extracted keywords: {keywords}")
            return keywords

        except Exception as e:
            logger.warning(f"Keyword extraction failed: {e}")
            return []

    def _expand_synonyms(self, query: str) -> List[str]:
        """
        同义词扩展

        Args:
            query: 用户查询

        Returns:
            同义词/相关词列表
        """
        try:
            client = self._get_client()
            response = client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "为用户查询中的核心概念提供3-5个同义词或相关术语。"
                            "只输出词语，用空格分隔，不要其他内容。"
                            "包括中英文对照、缩写、相关领域术语。"
                        )
                    },
                    {"role": "user", "content": query}
                ],
                max_tokens=80,
                temperature=0.3
            )
            synonyms_text = response.choices[0].message.content.strip()
            synonyms = synonyms_text.split()
            synonyms = [s for s in synonyms if len(s) > 1]
            logger.info(f"Expanded synonyms: {synonyms}")
            return synonyms

        except Exception as e:
            logger.warning(f"Synonym expansion failed: {e}")
            return []
