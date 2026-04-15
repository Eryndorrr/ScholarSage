"""
QA 基准集生成器

从知识库文档自动生成 (问题, 标准答案, 关联文档) 三元组
"""
import logging
import json
import re
from typing import List, Dict, Optional
from dataclasses import dataclass

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GeneratedQA:
    """生成的 QA 对"""
    question: str
    answer: str
    doc_ids: List[str]
    contexts: List[str]
    difficulty: str = "medium"
    category: str = ""


class BenchmarkGenerator:
    """基准集生成器"""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
                timeout=60
            )
        return self._client

    def generate_from_documents(
        self,
        documents: List[Dict],
        num_questions: int = 10
    ) -> List[GeneratedQA]:
        """
        从文档列表批量生成 QA 对

        Args:
            documents: [{"id": ..., "content": ..., "metadata": {...}}, ...]
            num_questions: 目标生成数量

        Returns:
            生成的 QA 对列表
        """
        if not documents:
            return []

        all_qa = []

        # 按文档逐个生成，确保每个 QA 有关联的源文档
        # 每个文档生成 2-3 个问题，直到达到目标数量
        questions_per_doc = max(2, num_questions // len(documents) + 1)

        for doc in documents:
            if len(all_qa) >= num_questions:
                break

            doc_id = doc.get("id", "")
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})

            if not content or len(content.strip()) < 50:
                continue

            qa_list = self._generate_qa_for_content(
                content=content,
                doc_id=doc_id,
                num_questions=min(questions_per_doc, num_questions - len(all_qa))
            )

            for qa in qa_list:
                qa.doc_ids = [doc_id]
                qa.contexts = [content[:500]]
                qa.category = metadata.get("title", "")
                all_qa.append(qa)

        logger.info(f"Generated {len(all_qa)} QA pairs from {len(documents)} documents")
        return all_qa[:num_questions]

    def generate_from_collection(
        self,
        collection_name: str,
        num_questions: int = 10
    ) -> List[GeneratedQA]:
        """
        从知识库自动采样文档并生成 QA 对

        Args:
            collection_name: 知识库集合名
            num_questions: 目标数量

        Returns:
            生成的 QA 对列表
        """
        from app.core.rag.retriever import Retriever

        retriever = Retriever()

        # 用多个通用查询采样文档，尽量覆盖不同内容
        sample_queries = [
            "主要内容和核心观点",
            "重要概念和定义",
            "方法和步骤",
            "结论和结果",
            "关键数据和信息"
        ]

        sampled_docs = {}  # 用 id 去重
        for query in sample_queries:
            results = retriever.retrieve(
                query=query,
                collection_name=collection_name,
                top_k=5
            )
            for r in results:
                doc_id = r.get("id", "")
                if doc_id and doc_id not in sampled_docs:
                    sampled_docs[doc_id] = r

        documents = list(sampled_docs.values())

        if not documents:
            logger.warning(f"No documents found in collection {collection_name}")
            return []

        return self.generate_from_documents(documents, num_questions)

    def _generate_qa_for_content(
        self,
        content: str,
        doc_id: str,
        num_questions: int = 3
    ) -> List[GeneratedQA]:
        """
        从单个文档内容生成 QA 对

        Args:
            content: 文档内容
            doc_id: 文档 ID
            num_questions: 生成问题数

        Returns:
            QA 对列表
        """
        client = self._get_client()

        # 截取内容避免超长
        text = content[:2000]

        prompt = f"""基于以下文档内容，生成 {num_questions} 个问答对。

要求：
1. 问题必须能从文档内容中找到明确答案
2. 涵盖不同难度：简单（直接找到）、中等（需要理解）、困难（需要推理）
3. 答案要准确、完整，直接引用文档中的关键信息
4. 不要生成无法从文档中回答的问题

文档内容：
{text}

以 JSON 数组格式返回：
[
    {{
        "question": "问题内容",
        "answer": "标准答案",
        "difficulty": "easy/medium/hard"
    }}
]
只输出 JSON 数组。"""

        try:
            response = client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": "你是一个专业的测试题生成专家，善于从文档中提炼关键信息构造问答对。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.3
            )

            content = response.choices[0].message.content.strip()
            qa_data = self._parse_json_response(content)

            if not isinstance(qa_data, list):
                return []

            results = []
            for item in qa_data[:num_questions]:
                if isinstance(item, dict) and "question" in item and "answer" in item:
                    results.append(GeneratedQA(
                        question=item["question"],
                        answer=item["answer"],
                        doc_ids=[doc_id],
                        contexts=[],
                        difficulty=item.get("difficulty", "medium"),
                        category=""
                    ))

            return results

        except Exception as e:
            logger.error(f"Failed to generate QA for doc {doc_id}: {e}")
            return []

    def _parse_json_response(self, text: str):
        """解析 LLM 返回的 JSON"""
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            json_match = re.search(r'\[.*\]', text, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            return []
