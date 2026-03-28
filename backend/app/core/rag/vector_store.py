from typing import List, Dict, Optional
import chromadb
from chromadb.config import Settings
from app.config import settings


class VectorStore:
    """Chroma向量存储"""

    def __init__(self, persist_dir: str = None):
        self.client = chromadb.Client(Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_dir or settings.chroma_persist_dir
        ))

    def create_collection(self, collection_name: str):
        """创建集合"""
        return self.client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def get_collection(self, collection_name: str):
        """获取集合"""
        return self.client.get_collection(name=collection_name)

    def delete_collection(self, collection_name: str):
        """删除集合"""
        self.client.delete_collection(name=collection_name)

    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict]] = None,
        ids: Optional[List[str]] = None
    ):
        """添加文档到向量库"""
        collection = self.get_collection(collection_name)
        collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

    def search(
        self,
        collection_name: str,
        query_embedding: List[float],
        top_k: int = 3
    ) -> Dict:
        """检索相似文档"""
        collection = self.get_collection(collection_name)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        return results