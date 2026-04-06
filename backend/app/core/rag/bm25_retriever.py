"""
BM25 检索模块
基于关键词的全文检索，与向量检索互补
"""
import logging
import pickle
import os
from typing import List, Dict, Optional
from pathlib import Path

from rank_bm25 import BM25Okapi
import jieba

from app.config import settings

logger = logging.getLogger(__name__)


class BM25Retriever:
    """BM25 关键词检索器"""

    def __init__(self, persist_dir: str = None):
        """
        初始化 BM25 检索器

        Args:
            persist_dir: 索引持久化目录
        """
        self.persist_dir = persist_dir or os.path.join(settings.chroma_persist_dir, "bm25")
        self.indices: Dict[str, BM25Okapi] = {}  # collection_name -> BM25 index
        self.corpus: Dict[str, Dict[str, List[str]]] = {}  # collection_name -> {doc_id: tokens}
        self.documents: Dict[str, Dict[str, Dict]] = {}  # collection_name -> {doc_id: doc_info}

        # 确保持久化目录存在
        Path(self.persist_dir).mkdir(parents=True, exist_ok=True)

        # 加载已有索引
        self._load_indices()

    def _tokenize(self, text: str) -> List[str]:
        """
        分词（支持中英文混合）

        Args:
            text: 待分词文本

        Returns:
            分词结果列表
        """
        # 使用 jieba 进行中文分词
        tokens = list(jieba.cut(text.lower()))
        # 过滤掉单字符和标点
        tokens = [t for t in tokens if len(t) > 1 or t.isalnum()]
        return tokens

    def _get_index_path(self, collection_name: str) -> str:
        """获取索引文件路径"""
        return os.path.join(self.persist_dir, f"{collection_name}.pkl")

    def _load_indices(self):
        """加载已持久化的索引"""
        if not os.path.exists(self.persist_dir):
            return

        for filename in os.listdir(self.persist_dir):
            if filename.endswith(".pkl"):
                collection_name = filename[:-4]
                try:
                    with open(os.path.join(self.persist_dir, filename), "rb") as f:
                        data = pickle.load(f)
                        self.indices[collection_name] = data.get("index")
                        self.corpus[collection_name] = data.get("corpus", {})
                        self.documents[collection_name] = data.get("documents", {})
                    logger.info(f"Loaded BM25 index for collection: {collection_name}")
                except Exception as e:
                    logger.error(f"Failed to load BM25 index {collection_name}: {e}")

    def _save_index(self, collection_name: str):
        """持久化索引"""
        try:
            with open(self._get_index_path(collection_name), "wb") as f:
                pickle.dump({
                    "index": self.indices.get(collection_name),
                    "corpus": self.corpus.get(collection_name, {}),
                    "documents": self.documents.get(collection_name, {})
                }, f)
            logger.info(f"Saved BM25 index for collection: {collection_name}")
        except Exception as e:
            logger.error(f"Failed to save BM25 index {collection_name}: {e}")

    def index_documents(
        self,
        collection_name: str,
        documents: List[Dict]
    ):
        """
        为文档集合构建 BM25 索引

        Args:
            collection_name: 集合名称
            documents: 文档列表，每个文档包含 id, content, metadata
        """
        if not documents:
            return

        # 初始化集合的存储
        if collection_name not in self.corpus:
            self.corpus[collection_name] = {}
            self.documents[collection_name] = {}

        # 添加文档
        tokenized_corpus = []
        for doc in documents:
            doc_id = doc.get("id")
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})

            # 分词
            tokens = self._tokenize(content)
            self.corpus[collection_name][doc_id] = tokens
            self.documents[collection_name][doc_id] = {
                "content": content,
                "metadata": metadata,
                "id": doc_id
            }
            tokenized_corpus.append(tokens)

        # 构建 BM25 索引
        if tokenized_corpus:
            self.indices[collection_name] = BM25Okapi(tokenized_corpus)
            self._save_index(collection_name)
            logger.info(f"Indexed {len(documents)} documents for BM25 in collection: {collection_name}")

    def add_document(self, collection_name: str, document: Dict):
        """
        添加单个文档到索引

        Args:
            collection_name: 集合名称
            document: 文档，包含 id, content, metadata
        """
        # 获取现有文档
        existing_docs = list(self.documents.get(collection_name, {}).values())

        # 检查是否已存在
        doc_id = document.get("id")
        if collection_name in self.documents and doc_id in self.documents[collection_name]:
            # 更新现有文档
            existing_docs = [d for d in existing_docs if d.get("id") != doc_id]

        existing_docs.append(document)

        # 重建索引
        self._rebuild_index(collection_name, existing_docs)

    def remove_document(self, collection_name: str, doc_id: str):
        """
        从索引中移除文档

        Args:
            collection_name: 集合名称
            doc_id: 文档ID
        """
        if collection_name not in self.documents:
            return

        # 删除该文档的所有 chunks（根据 metadata.document_id）
        doc_ids_to_remove = [
            chunk_id for chunk_id, doc_info in self.documents[collection_name].items()
            if doc_info.get("metadata", {}).get("document_id") == doc_id
        ]

        for chunk_id in doc_ids_to_remove:
            self.documents[collection_name].pop(chunk_id, None)
            self.corpus[collection_name].pop(chunk_id, None)

        # 重建索引
        remaining_docs = list(self.documents.get(collection_name, {}).values())
        self._rebuild_index(collection_name, remaining_docs)
        logger.info(f"Removed {len(doc_ids_to_remove)} chunks from BM25 index for document {doc_id}")

    def _rebuild_index(self, collection_name: str, documents: List[Dict]):
        """重建索引"""
        if not documents:
            self.indices[collection_name] = None
            self.corpus[collection_name] = {}
            self.documents[collection_name] = {}
        else:
            tokenized_corpus = []
            self.corpus[collection_name] = {}
            self.documents[collection_name] = {}

            for doc in documents:
                doc_id = doc.get("id")
                content = doc.get("content", "")
                tokens = self._tokenize(content)
                self.corpus[collection_name][doc_id] = tokens
                self.documents[collection_name][doc_id] = doc
                tokenized_corpus.append(tokens)

            if tokenized_corpus:
                self.indices[collection_name] = BM25Okapi(tokenized_corpus)

        self._save_index(collection_name)

    def delete_collection(self, collection_name: str):
        """
        删除集合的索引

        Args:
            collection_name: 集合名称
        """
        # 从内存中删除
        self.indices.pop(collection_name, None)
        self.corpus.pop(collection_name, None)
        self.documents.pop(collection_name, None)

        # 删除持久化文件
        index_path = self._get_index_path(collection_name)
        if os.path.exists(index_path):
            os.remove(index_path)
            logger.info(f"Deleted BM25 index for collection: {collection_name}")

    def search(
        self,
        collection_name: str,
        query: str,
        top_k: int = 10
    ) -> List[Dict]:
        """
        BM25 检索

        Args:
            collection_name: 集合名称
            query: 查询文本
            top_k: 返回结果数量

        Returns:
            检索结果列表，格式与向量检索一致
        """
        if collection_name not in self.indices or self.indices[collection_name] is None:
            logger.warning(f"No BM25 index found for collection: {collection_name}")
            return []

        # 分词查询
        query_tokens = self._tokenize(query)

        # BM25 检索
        scores = self.indices[collection_name].get_scores(query_tokens)

        # 获取文档ID列表
        doc_ids = list(self.documents[collection_name].keys())

        # 排序并获取 top_k
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]

        results = []
        for idx in top_indices:
            if scores[idx] > 0:  # 只返回有正分数的结果
                doc_id = doc_ids[idx]
                doc_info = self.documents[collection_name][doc_id]
                results.append({
                    "id": doc_id,
                    "content": doc_info.get("content", ""),
                    "metadata": doc_info.get("metadata", {}),
                    "score": float(scores[idx]),
                    "distance": 1 - float(scores[idx])  # 转换为距离格式（与向量检索兼容）
                })

        return results

    def get_collection_stats(self, collection_name: str) -> Dict:
        """
        获取集合统计信息

        Args:
            collection_name: 集合名称

        Returns:
            统计信息
        """
        if collection_name not in self.documents:
            return {"document_count": 0, "indexed": False}

        return {
            "document_count": len(self.documents[collection_name]),
            "indexed": self.indices.get(collection_name) is not None
        }


# 全局 BM25 检索器实例
_bm25_retriever: Optional[BM25Retriever] = None


def get_bm25_retriever() -> BM25Retriever:
    """获取 BM25 检索器单例"""
    global _bm25_retriever
    if _bm25_retriever is None:
        _bm25_retriever = BM25Retriever()
    return _bm25_retriever
