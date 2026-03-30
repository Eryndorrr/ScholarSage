from typing import List
from openai import OpenAI
from app.config import settings
import concurrent.futures


class EmbeddingEngine:
    """文本向量化引擎"""

    def __init__(self, api_key: str = None, model: str = None, base_url: str = None):
        self.client = OpenAI(
            api_key=api_key or settings.openai_api_key,
            base_url=base_url or settings.openai_base_url
        )
        self.model = model or settings.embedding_model
        self.batch_size = 100  # 每批最多处理的文本数量
        self.max_workers = 3   # 并发工作线程数

    def embed_text(self, text: str) -> List[float]:
        """单个文本向量化"""
        response = self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批量文本向量化 - 分批处理并发调用"""
        if not texts:
            return []

        # 如果文本数量少，直接处理
        if len(texts) <= self.batch_size:
            return self._embed_single_batch(texts)

        # 分批处理
        all_embeddings = []
        batches = [texts[i:i + self.batch_size] for i in range(0, len(texts), self.batch_size)]

        # 使用线程池并发处理
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self._embed_single_batch, batch): i
                       for i, batch in enumerate(batches)}

            # 按顺序收集结果
            results = [None] * len(batches)
            for future in concurrent.futures.as_completed(futures):
                batch_idx = futures[future]
                try:
                    results[batch_idx] = future.result()
                except Exception as e:
                    print(f"Embedding batch {batch_idx} failed: {e}")
                    # 对于失败的批次，返回空向量作为占位
                    results[batch_idx] = [[] for _ in batches[batch_idx]]

        # 合并结果
        for result in results:
            if result:
                all_embeddings.extend(result)

        return all_embeddings

    def _embed_single_batch(self, texts: List[str]) -> List[List[float]]:
        """处理单个批次的向量化"""
        response = self.client.embeddings.create(
            input=texts,
            model=self.model
        )
        return [item.embedding for item in response.data]