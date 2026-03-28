from typing import List
from openai import OpenAI
from app.config import settings


class Generator:
    """答案生成器"""

    def __init__(self, api_key: str = None, model: str = None):
        self.client = OpenAI(api_key=api_key or settings.openai_api_key)
        self.model = model or settings.openai_model

    def generate_answer(
        self,
        question: str,
        contexts: List[str],
        max_tokens: int = 1000
    ) -> str:
        """基于上下文生成答案"""
        # 构建提示词
        context_text = "\n\n".join([f"[{i+1}] {ctx}" for i, ctx in enumerate(contexts)])

        prompt = f"""基于以下参考内容回答问题。请在答案中标注引用来源，格式为[1]、[2]等。

参考内容：
{context_text}

问题：{question}

答案："""

        # 调用LLM
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个专业的问答助手，善于基于提供的参考资料给出准确、有引用的答案。"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=0.7
        )

        return response.choices[0].message.content