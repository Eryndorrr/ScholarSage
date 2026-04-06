"""
重排序模块
基于 API 的重排序（SiliconFlow/兼容服务）
"""
import logging
import httpx
from typing import List, Dict, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class Reranker:
    """基于 API 的重排序器"""

    def __init__(self):
        """
        初始化重排序器
        使用配置的 API 端点和密钥
        """
        self.api_key = settings.rerank_api_key or settings.openai_api_key
        self.base_url = (settings.rerank_base_url or settings.openai_base_url).rstrip("/")
        self.model = settings.rerank_model
        self.timeout = 30.0

    async def rerank(
        self,
        query: str,
        documents: List[Dict],
        top_k: int = 3
    ) -> List[Dict]:
        """
        异步重排序

        Args:
            query: 查询文本
            documents: 文档列表，每个包含 content, metadata 等
            top_k: 返回数量

        Returns:
            重排序后的文档列表
        """
        if not documents:
            return []

        if len(documents) <= top_k:
            return documents

        # 提取文档内容
        doc_contents = [doc.get("content", "") for doc in documents]

        try:
            # 调用重排序 API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/rerank",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "query": query,
                        "documents": doc_contents,
                        "top_n": min(top_k, len(documents)),
                        "return_documents": False
                    }
                )

                if response.status_code != 200:
                    logger.error(f"Rerank API error: {response.status_code} - {response.text}")
                    # 降级：返回原始文档的前 top_k
                    return documents[:top_k]

                result = response.json()

                # 解析结果
                reranked_results = []
                for item in result.get("results", []):
                    index = item.get("index", 0)
                    relevance_score = item.get("relevance_score", 0)

                    if 0 <= index < len(documents):
                        doc = documents[index].copy()
                        doc["rerank_score"] = relevance_score
                        doc["distance"] = 1 - relevance_score  # 转换为距离
                        reranked_results.append(doc)

                logger.info(f"Reranked {len(documents)} documents, returned top {len(reranked_results)}")
                return reranked_results

        except httpx.TimeoutException:
            logger.error("Rerank API timeout")
            return documents[:top_k]
        except Exception as e:
            logger.error(f"Rerank failed: {e}")
            return documents[:top_k]

    def rerank_sync(
        self,
        query: str,
        documents: List[Dict],
        top_k: int = 3
    ) -> List[Dict]:
        """
        同步重排序（用于非异步环境）

        Args:
            query: 查询文本
            documents: 文档列表
            top_k: 返回数量

        Returns:
            重排序后的文档列表
        """
        if not documents:
            return []

        if len(documents) <= top_k:
            return documents

        # 提取文档内容
        doc_contents = [doc.get("content", "") for doc in documents]

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{self.base_url}/rerank",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "query": query,
                        "documents": doc_contents,
                        "top_n": min(top_k, len(documents)),
                        "return_documents": False
                    }
                )

                if response.status_code != 200:
                    logger.error(f"Rerank API error: {response.status_code} - {response.text}")
                    return documents[:top_k]

                result = response.json()

                # 解析结果
                reranked_results = []
                for item in result.get("results", []):
                    index = item.get("index", 0)
                    relevance_score = item.get("relevance_score", 0)

                    if 0 <= index < len(documents):
                        doc = documents[index].copy()
                        doc["rerank_score"] = relevance_score
                        doc["distance"] = 1 - relevance_score
                        reranked_results.append(doc)

                logger.info(f"Reranked {len(documents)} documents, returned top {len(reranked_results)}")
                return reranked_results

        except httpx.TimeoutException:
            logger.error("Rerank API timeout")
            return documents[:top_k]
        except Exception as e:
            logger.error(f"Rerank failed: {e}")
            return documents[:top_k]


# 全局重排序器实例
_reranker: Optional[Reranker] = None


def get_reranker() -> Reranker:
    """获取重排序器单例"""
    global _reranker
    if _reranker is None:
        _reranker = Reranker()
    return _reranker
