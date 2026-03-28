from typing import List, Dict
from app.core.rag.embeddings import EmbeddingEngine
from app.core.rag.vector_store import VectorStore


class Retriever:
    """文档检索器"""

    def __init__(self, vector_store: VectorStore = None, embedding_engine: EmbeddingEngine = None):
        self.vector_store = vector_store or VectorStore()
        self.embedding_engine = embedding_engine or EmbeddingEngine()

    def retrieve(
        self,
        query: str,
        collection_name: str,
        top_k: int = 3
    ) -> List[Dict]:
        """检索相关文档"""
        # 向量化查询
        query_embedding = self.embedding_engine.embed_text(query)

        # 检索相似文档
        results = self.vector_store.search(
            collection_name=collection_name,
            query_embedding=query_embedding,
            top_k=top_k
        )

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