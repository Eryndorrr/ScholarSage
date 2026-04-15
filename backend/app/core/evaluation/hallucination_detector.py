"""
幻觉检测模块

检测 LLM 回答是否脱离了提供的上下文，标记可能幻觉的内容。
"""
import logging
import re
import json
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class HallucinationClaim:
    """单条陈述的幻觉检测结果"""
    claim: str
    is_supported: bool  # 是否有上下文支撑
    confidence: float  # 检测置信度 0-1
    reasoning: str = ""  # 判断依据


@dataclass
class HallucinationResult:
    """幻觉检测结果"""
    has_hallucination: bool  # 是否存在幻觉
    hallucination_ratio: float  # 幻觉陈述占比
    claims: List[HallucinationClaim] = field(default_factory=list)
    overall_score: float = 1.0  # 整体可信度 0-1


class HallucinationDetector:
    """幻觉检测器"""

    def __init__(self):
        self._client = None

    def _get_client(self):
        """延迟初始化 OpenAI 客户端"""
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
                timeout=30
            )
        return self._client

    def detect(
        self,
        answer: str,
        contexts: List[str],
        detail_level: str = "full"
    ) -> HallucinationResult:
        """
        检测答案中的幻觉

        Args:
            answer: LLM 生成的答案
            contexts: 提供的上下文文档
            detail_level: "full" 逐条检测, "quick" 快速整体评估

        Returns:
            HallucinationResult
        """
        if not answer or not contexts:
            return HallucinationResult(
                has_hallucination=False,
                hallucination_ratio=0.0,
                overall_score=1.0
            )

        try:
            if detail_level == "quick":
                return self._quick_detect(answer, contexts)
            else:
                return self._full_detect(answer, contexts)
        except Exception as e:
            logger.error(f"Hallucination detection failed: {e}")
            return HallucinationResult(
                has_hallucination=False,
                hallucination_ratio=0.0,
                overall_score=0.5  # 检测失败时给中间分数
            )

    def _quick_detect(self, answer: str, contexts: List[str]) -> HallucinationResult:
        """快速整体评估"""
        client = self._get_client()
        context_text = "\n\n".join(contexts)[:3000]

        prompt = f"""评估以下答案是否完全基于提供的上下文，是否存在脱离上下文的幻觉内容。

上下文：
{context_text}

答案：
{answer}

请评估：
1. 答案中是否有无法从上下文推断的内容？
2. 是否存在编造的事实、数据或细节？

以 JSON 格式返回：
{{
    "has_hallucination": true/false,
    "hallucination_ratio": 0.0-1.0,
    "overall_score": 0.0-1.0,
    "reasoning": "判断依据"
}}
只输出 JSON。"""

        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0
        )

        result = self._parse_json_response(response.choices[0].message.content)

        return HallucinationResult(
            has_hallucination=result.get("has_hallucination", False),
            hallucination_ratio=result.get("hallucination_ratio", 0.0),
            overall_score=result.get("overall_score", 1.0),
            claims=[HallucinationClaim(
                claim="整体评估",
                is_supported=not result.get("has_hallucination", False),
                confidence=result.get("overall_score", 1.0),
                reasoning=result.get("reasoning", "")
            )]
        )

    def _full_detect(self, answer: str, contexts: List[str]) -> HallucinationResult:
        """逐条陈述检测"""
        client = self._get_client()

        # Step 1: 分解答案为独立陈述
        claims = self._extract_claims(client, answer)
        if not claims:
            return HallucinationResult(
                has_hallucination=False,
                hallucination_ratio=0.0,
                overall_score=1.0
            )

        # Step 2: 逐条验证
        context_text = "\n\n".join(contexts)[:3000]
        hallucination_claims = []
        supported_claims = []

        for claim in claims[:8]:  # 最多验证 8 条陈述
            verification = self._verify_claim(client, claim, context_text)
            if verification.is_supported:
                supported_claims.append(verification)
            else:
                hallucination_claims.append(verification)

        all_claims = supported_claims + hallucination_claims
        total = len(all_claims)
        hallucination_ratio = len(hallucination_claims) / total if total > 0 else 0.0
        overall_score = len(supported_claims) / total if total > 0 else 1.0

        return HallucinationResult(
            has_hallucination=len(hallucination_claims) > 0,
            hallucination_ratio=round(hallucination_ratio, 3),
            claims=all_claims,
            overall_score=round(overall_score, 3)
        )

    def _extract_claims(self, client, answer: str) -> List[str]:
        """将答案分解为独立陈述"""
        prompt = f"""将以下答案分解为独立的事实性陈述句，每个陈述应该是一个可以独立验证的事实。

答案：
{answer}

以 JSON 数组格式返回，例如：["陈述1", "陈述2", "陈述3"]
只输出 JSON 数组。"""

        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0
        )

        result = self._parse_json_response(response.choices[0].message.content)
        if isinstance(result, list):
            return [str(item) for item in result if str(item).strip()]
        return []

    def _verify_claim(self, client, claim: str, context_text: str) -> HallucinationClaim:
        """验证单条陈述是否被上下文支持"""
        prompt = f"""判断以下陈述是否可以从提供的上下文中直接推断出来。

上下文：
{context_text}

陈述：{claim}

以 JSON 格式返回：
{{
    "is_supported": true/false,
    "confidence": 0.0-1.0,
    "reasoning": "判断依据"
}}
只输出 JSON。"""

        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0
        )

        result = self._parse_json_response(response.choices[0].message.content)

        return HallucinationClaim(
            claim=claim,
            is_supported=result.get("is_supported", True),
            confidence=result.get("confidence", 0.5),
            reasoning=result.get("reasoning", "")
        )

    def _parse_json_response(self, text: str) -> dict:
        """解析 LLM 返回的 JSON"""
        try:
            # 尝试直接解析
            return json.loads(text.strip())
        except json.JSONDecodeError:
            # 尝试提取 JSON
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass

            # 尝试提取数组
            array_match = re.search(r'\[.*\]', text, re.DOTALL)
            if array_match:
                try:
                    return json.loads(array_match.group())
                except json.JSONDecodeError:
                    pass

            return {}
