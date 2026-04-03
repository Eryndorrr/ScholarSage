from typing import List, Dict, Optional
from openai import OpenAI, APIError
from app.config import settings
import json
import logging

logger = logging.getLogger(__name__)


class DialogManagerError(Exception):
    """Dialog Manager custom exception"""
    pass


class DialogManager:
    """多轮对话管理器 - 负责上下文管理和摘要生成"""

    def __init__(
        self,
        api_key: str = None,
        model: str = None,
        base_url: str = None,
        max_history_tokens: int = 4000,  # 最大历史token数
        summary_threshold: int = 10      # 超过10轮对话触发摘要
    ):
        self.client = OpenAI(
            api_key=api_key or settings.openai_api_key,
            base_url=base_url or settings.openai_base_url
        )
        self.model = model or settings.openai_model
        self.max_history_tokens = max_history_tokens
        self.summary_threshold = summary_threshold

    def build_context(
        self,
        question: str,
        history: List[Dict[str, str]],
        summary: Optional[str] = None,
        max_messages: int = 6
    ) -> List[Dict[str, str]]:
        """
        构建多轮对话上下文

        Args:
            question: 当前问题
            history: 历史消息列表 [{"role": "user/assistant", "content": "..."}]
            summary: 之前的对话摘要
            max_messages: 最大保留的消息数

        Returns:
            用于发送给LLM的消息列表
        """
        messages = []

        # 系统提示
        system_content = "你是一个专业的问答助手，善于基于提供的参考资料给出准确、有引用的答案。"
        if summary:
            system_content += f"\n\n以下是之前对话的摘要，请参考：\n{summary}"

        messages.append({"role": "system", "content": system_content})

        # 添加最近的历史消息（限制数量）
        recent_history = history[-max_messages:] if len(history) > max_messages else history
        for msg in recent_history:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        # 添加当前问题
        messages.append({"role": "user", "content": question})

        return messages

    def generate_summary(
        self,
        messages: List[Dict[str, str]]
    ) -> str:
        """
        生成对话摘要

        Args:
            messages: 需要摘要的消息列表

        Returns:
            对话摘要
        """
        if not messages:
            return ""

        # 构建对话文本
        conversation = "\n".join([
            f"{'用户' if m['role'] == 'user' else '助手'}: {m['content']}"
            for m in messages
        ])

        prompt = f"""请将以下对话压缩成简洁的摘要，保留关键信息和上下文：

{conversation}

摘要（200字以内）："""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的对话摘要助手，善于提取关键信息。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )

            summary = response.choices[0].message.content.strip()
            logger.info(f"Generated summary: {summary[:100]}...")
            return summary

        except APIError as e:
            logger.error(f"Failed to generate summary: {e}")
            # 返回简单的摘要
            return f"对话包含 {len(messages)} 条消息"

    def should_summarize(
        self,
        message_count: int,
        current_summary: Optional[str] = None
    ) -> bool:
        """
        判断是否需要生成摘要

        Args:
            message_count: 当前消息数量
            current_summary: 是否已有摘要

        Returns:
            是否需要生成摘要
        """
        return message_count >= self.summary_threshold and not current_summary

    def estimate_tokens(self, messages: List[Dict[str, str]]) -> int:
        """
        估算消息的token数量（简单估算：中文约1.5字符/token，英文约4字符/token）
        """
        total_chars = sum(len(m.get("content", "")) for m in messages)
        # 保守估计，假设平均2.5字符/token
        return int(total_chars / 2.5)
