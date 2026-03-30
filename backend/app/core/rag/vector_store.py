from typing import List, Dict, Optional
import chromadb
from chromadb.errors import ChromaError
from app.config import settings


class VectorStoreError(Exception):
    """Vector store custom exception"""
    pass


class VectorStore:
    """Chroma向量存储"""

    def __init__(self, persist_dir: str = None):
        # 禁用遥测以避免警告
        self.client = chromadb.PersistentClient(
            path=persist_dir or settings.chroma_persist_dir,
            anonymized_telemetry=False
        )

    def create_collection(self, collection_name: str):
        """创建集合"""
        try:
            return self.client.create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        except ChromaError as e:
            raise VectorStoreError(f"Failed to create collection: {e}")

    def get_collection(self, collection_name: str):
        """获取集合，不存在返回None"""
        try:
            return self.client.get_collection(name=collection_name)
        except ValueError:
            # Collection 不存在
            return None
        except ChromaError as e:
            raise VectorStoreError(f"Failed to get collection: {e}")

    def get_or_create_collection(self, collection_name: str):
        """获取或创建集合"""
        try:
            return self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        except ChromaError as e:
            raise VectorStoreError(f"Failed to get or create collection: {e}")

    def delete_collection(self, collection_name: str):
        """删除集合"""
        try:
            self.client.delete_collection(name=collection_name)
        except ChromaError as e:
            raise VectorStoreError(f"Failed to delete collection: {e}")

    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict]] = None,
        ids: Optional[List[str]] = None
    ):
        """添加文档到向量库"""
        try:
            collection = self.get_or_create_collection(collection_name)
            collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
        except ChromaError as e:
            raise VectorStoreError(f"Failed to add documents: {e}")

    def search(
        self,
        collection_name: str,
        query_embedding: List[float],
        top_k: int = 3
    ) -> Dict:
        """检索相似文档"""
        try:
            collection = self.get_collection(collection_name)
            if collection is None:
                # Collection 不存在，返回空结果
                return {
                    'documents': [[]],
                    'metadatas': [[]],
                    'distances': [[]],
                    'ids': [[]]
                }
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            return results
        except ChromaError as e:
            raise VectorStoreError(f"Failed to search: {e}")