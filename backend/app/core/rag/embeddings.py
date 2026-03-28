from typing import List
from openai import OpenAI
from app.config import settings


class EmbeddingEngine:
    """文本向量化引擎"""

    def __init__(self, api_key: str = None, model: str = None):
        self.client = OpenAI(api_key=api_key or settings.openai_api_key)
        self.model = model or settings.embedding_model

    def embed_text(self, text: str) -> List[float]:
        """单个文本向量化"""
        response = self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批量文本向量化"""
        response = self.client.embeddings.create(
            input=texts,
            model=self.model
        )
        return [item.embedding for item in response.data]