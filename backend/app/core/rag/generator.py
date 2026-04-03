from typing import List, Optional, Dict
from openai import OpenAI, APIError
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class GeneratorError(Exception):
    """Generator custom exception"""
    pass


class Generator:
    """答案生成器"""

    def __init__(self, api_key: str = None, model: str = None, base_url: str = None):
        self.client = OpenAI(
            api_key=api_key or settings.openai_api_key,
            base_url=base_url or settings.openai_base_url
        )
        self.model = model or settings.openai_model

    def generate_answer(
        self,
        question: str,
        contexts: List[str],
        history: Optional[List[Dict[str, str]]] = None,
        summary: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> str:
        """
        基于上下文生成答案（支持多轮对话）

        Args:
            question: 当前问题
            contexts: 检索到的相关文档
            history: 历史对话 [{"role": "user/assistant", "content": "..."}]
            summary: 之前的对话摘要
            max_tokens: 最大生成token数
            temperature: 温度参数
        """
        # 构建上下文
        context_text = "\n\n".join([f"[{i+1}] {ctx}" for i, ctx in enumerate(contexts)])

        # 构建系统提示
        system_content = "你是一个专业的问答助手，善于基于提供的参考资料给出准确、有引用的答案。请在答案中标注引用来源，格式为[1]、[2]等。"

        # 如果有摘要，添加到系统提示
        if summary:
            system_content += f"\n\n以下是之前对话的摘要，请参考以保持对话连贯性：\n{summary}"

        # 构建消息列表
        messages = [{"role": "system", "content": system_content}]

        # 添加历史对话（保留最近6轮）
        if history:
            recent_history = history[-12:] if len(history) > 12 else history  # 最多保留6轮（12条消息）
            for msg in recent_history:
                # 简化历史消息中的内容，避免过长
                content = msg["content"]
                if len(content) > 500:
                    content = content[:500] + "..."
                messages.append({
                    "role": msg["role"],
                    "content": content
                })

        # 添加当前问题和上下文
        user_prompt = f"""基于以下参考内容回答问题。

参考内容：
{context_text}

问题：{question}

答案："""

        messages.append({"role": "user", "content": user_prompt})

        try:
            # 调用LLM
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )

            return response.choices[0].message.content
        except APIError as e:
            logger.error(f"Failed to generate answer: {e}")
            raise GeneratorError(f"Failed to generate answer: {e}")

    def generate_session_title(self, first_question: str) -> str:
        """
        根据第一个问题生成会话标题

        Args:
            first_question: 会话的第一个问题

        Returns:
            生成的标题
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "请用5-10个字概括以下问题的主题，直接输出标题，不要其他内容。"},
                    {"role": "user", "content": first_question}
                ],
                max_tokens=20,
                temperature=0.3
            )
            return response.choices[0].message.content.strip()[:50]
        except Exception as e:
            logger.warning(f"Failed to generate title: {e}")
            # 返回问题的前20个字符作为标题
            return first_question[:20] + ("..." if len(first_question) > 20 else "")
