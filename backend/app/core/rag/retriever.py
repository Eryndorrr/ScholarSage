"""
文档检索器
支持向量检索、混合检索和重排序
"""
import logging
from typing import List, Dict, Optional

from app.core.rag.embeddings import EmbeddingEngine
from app.core.rag.vector_store import VectorStore, VectorStoreError
from app.core.rag.bm25_retriever import get_bm25_retriever, BM25Retriever
from app.core.rag.reranker import get_reranker, Reranker
from app.config import settings

logger = logging.getLogger(__name__)


class RetrieverError(Exception):
    """Retriever custom exception"""
    pass


class Retriever:
    """文档检索器，支持多种检索模式"""

    def __init__(
        self,
        vector_store: VectorStore = None,
        embedding_engine: EmbeddingEngine = None,
        bm25_retriever: BM25Retriever = None,
        reranker: Reranker = None
    ):
        self.vector_store = vector_store or VectorStore()
        self.embedding_engine = embedding_engine or EmbeddingEngine()
        self.bm25_retriever = bm25_retriever or get_bm25_retriever()
        self.reranker = reranker or get_reranker()

    def retrieve(
        self,
        query: str,
        collection_name: str,
        top_k: int = 3,
        use_hybrid: bool = None,
        use_rerank: bool = None
    ) -> List[Dict]:
        """
        检索相关文档

        Args:
            query: 查询文本
            collection_name: 集合名称
            top_k: 返回结果数量
            use_hybrid: 是否使用混合检索（默认使用配置）
            use_rerank: 是否使用重排序（默认使用配置）

        Returns:
            检索结果列表
        """
        # 使用配置默认值
        if use_hybrid is None:
            use_hybrid = settings.use_hybrid_search
        if use_rerank is None:
            use_rerank = settings.use_rerank

        try:
            # 获取更多候选用于重排序
            candidate_count = settings.rerank_top_k if use_rerank else top_k

            if use_hybrid:
                # 混合检索
                candidates = self._hybrid_search(query, collection_name, candidate_count)
            else:
                # 纯向量检索
                candidates = self._vector_search(query, collection_name, candidate_count)

            # 重排序
            if use_rerank and len(candidates) > top_k:
                candidates = self.reranker.rerank_sync(query, candidates, top_k)

            return candidates[:top_k]

        except Exception as e:
            logger.error(f"Retrieve failed: {e}")
            raise RetrieverError(f"Failed to retrieve documents: {e}")

    def _vector_search(
        self,
        query: str,
        collection_name: str,
        top_k: int
    ) -> List[Dict]:
        """
        纯向量检索

        Args:
            query: 查询文本
            collection_name: 集合名称
            top_k: 返回数量

        Returns:
            检索结果
        """
        # 向量化查询
        query_embedding = self.embedding_engine.embed_text(query)

        # 检索相似文档
        results = self.vector_store.search(
            collection_name=collection_name,
            query_embedding=query_embedding,
            top_k=top_k
        )

        # 检查空结果
        if not results or not results.get('documents') or not results['documents'][0]:
            return []

        # 格式化结果
        formatted_results = []
        for i in range(len(results['documents'][0])):
            formatted_results.append({
                'content': results['documents'][0][i],
                'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                'distance': results['distances'][0][i] if results['distances'] else 0,
                'id': results['ids'][0][i]
            })

        return formatted_results

    def _hybrid_search(
        self,
        query: str,
        collection_name: str,
        top_k: int
    ) -> List[Dict]:
        """
        混合检索：向量 + BM25

        使用 Reciprocal Rank Fusion (RRF) 融合结果

        Args:
            query: 查询文本
            collection_name: 集合名称
            top_k: 返回数量

        Returns:
            融合后的检索结果
        """
        # 获取比需求更多的候选
        fetch_k = min(top_k * 3, 50)

        # 并行执行两种检索
        vector_results = self._vector_search(query, collection_name, fetch_k)
        bm25_results = self.bm25_retriever.search(collection_name, query, fetch_k)

        # RRF 融合
        fused_results = self._rrf_fusion(
            vector_results,
            bm25_results,
            alpha=settings.hybrid_alpha
        )

        return fused_results[:top_k]

    def _rrf_fusion(
        self,
        vector_results: List[Dict],
        bm25_results: List[Dict],
        alpha: float = 0.5,
        k: int = 60
    ) -> List[Dict]:
        """
        Reciprocal Rank Fusion (RRF) 融合算法

        RRF_score(d) = alpha * 1/(k + rank_vector) + (1-alpha) * 1/(k + rank_bm25)

        Args:
            vector_results: 向量检索结果
            bm25_results: BM25 检索结果
            alpha: 向量检索权重 (0-1)
            k: RRF 参数，通常为 60

        Returns:
            融合后的结果
        """
        # 文档ID到分数和文档的映射
        doc_scores: Dict[str, Dict] = {}

        # 处理向量检索结果
        for rank, doc in enumerate(vector_results, 1):
            doc_id = doc.get('id')
            if doc_id:
                rrf_score = alpha / (k + rank)
                if doc_id not in doc_scores:
                    doc_scores[doc_id] = {
                        'doc': doc,
                        'score': 0
                    }
                doc_scores[doc_id]['score'] += rrf_score

        # 处理 BM25 检索结果
        for rank, doc in enumerate(bm25_results, 1):
            doc_id = doc.get('id')
            if doc_id:
                rrf_score = (1 - alpha) / (k + rank)
                if doc_id not in doc_scores:
                    doc_scores[doc_id] = {
                        'doc': doc,
                        'score': 0
                    }
                doc_scores[doc_id]['score'] += rrf_score

        # 按融合分数排序
        sorted_results = sorted(
            doc_scores.values(),
            key=lambda x: x['score'],
            reverse=True
        )

        # 格式化输出
        results = []
        for item in sorted_results:
            doc = item['doc'].copy()
            doc['fusion_score'] = item['score']
            doc['distance'] = 1 - item['score']  # 转换为距离格式
            results.append(doc)

        return results

    def index_for_bm25(
        self,
        collection_name: str,
        documents: List[Dict]
    ):
        """
        为 BM25 索引文档

        Args:
            collection_name: 集合名称
            documents: 文档列表
        """
        self.bm25_retriever.index_documents(collection_name, documents)
        logger.info(f"Indexed {len(documents)} documents for BM25 in {collection_name}")

    def remove_from_bm25(
        self,
        collection_name: str,
        doc_id: str
    ):
        """
        从 BM25 索引中移除文档

        Args:
            collection_name: 集合名称
            doc_id: 文档ID
        """
        self.bm25_retriever.remove_document(collection_name, doc_id)
        logger.info(f"Removed document {doc_id} from BM25 index in {collection_name}")

    def delete_bm25_collection(self, collection_name: str):
        """
        删除 BM25 索引

        Args:
            collection_name: 集合名称
        """
        self.bm25_retriever.delete_collection(collection_name)
        logger.info(f"Deleted BM25 index for collection: {collection_name}")
