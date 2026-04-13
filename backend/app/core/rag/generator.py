from typing import List, Optional, Dict, Generator as TypeGenerator
from openai import OpenAI, APIError, APITimeoutError, APIConnectionError, RateLimitError
from app.config import settings
from app.core.monitoring import record_llm_call, record_llm_failure, record_llm_fallback
import logging
import re
import time
import functools

logger = logging.getLogger(__name__)


class GeneratorError(Exception):
    """Generator custom exception"""
    pass


def retry_with_backoff(
    max_retries: int = None,
    initial_delay: float = None,
    multiplier: float = None,
    retryable_exceptions: tuple = (APIError, APITimeoutError, APIConnectionError, RateLimitError)
):
    """
    带指数退避的重试装饰器

    Args:
        max_retries: 最大重试次数
        initial_delay: 初始延迟（秒）
        multiplier: 延迟倍数
        retryable_exceptions: 可重试的异常类型
    """
    max_retries = max_retries or settings.llm_max_retries
    initial_delay = initial_delay or settings.llm_retry_delay
    multiplier = multiplier or settings.llm_retry_multiplier

    def decorator(func):
        @functools.wraps(func)
        def wrapper(self, *args, **kwargs):
            last_exception = None
            delay = initial_delay

            for attempt in range(max_retries + 1):
                try:
                    return func(self, *args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"LLM API call failed (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                            f"Retrying in {delay:.1f}s..."
                        )
                        time.sleep(delay)
                        delay *= multiplier
                    else:
                        logger.error(f"LLM API call failed after {max_retries + 1} attempts: {e}")
                except Exception as e:
                    # 不可重试的异常直接抛出
                    raise e

            raise GeneratorError(f"LLM API call failed after {max_retries + 1} attempts: {last_exception}")
        return wrapper
    return decorator


class Generator:
    """答案生成器（支持多模型降级和自动重试）"""

    def __init__(self, api_key: str = None, model: str = None, base_url: str = None):
        self.client = OpenAI(
            api_key=api_key or settings.openai_api_key,
            base_url=base_url or settings.openai_base_url,
            timeout=settings.llm_timeout
        )
        self.model = model or settings.openai_model

        # 解析备用模型列表
        fallback_models = settings.llm_fallback_models.strip()
        self.fallback_models = [m.strip() for m in fallback_models.split(",") if m.strip()] if fallback_models else []

    def _get_models_to_try(self) -> List[str]:
        """获取要尝试的模型列表（主模型 + 备用模型）"""
        models = [self.model]
        for fallback in self.fallback_models:
            if fallback not in models:
                models.append(fallback)
        return models

    def _call_with_fallback(self, call_func, operation_name: str = "LLM call"):
        """
        带降级的 API 调用

        Args:
            call_func: 调用函数，接受 model 参数
            operation_name: 操作名称（用于日志）
        """
        models = self._get_models_to_try()
        last_exception = None

        for i, model in enumerate(models):
            try:
                logger.info(f"{operation_name}: trying model {model} ({i + 1}/{len(models)})")
                result = call_func(model)
                record_llm_call(model, operation_name)
                if i > 0:
                    logger.info(f"{operation_name}: succeeded with fallback model {model}")
                    record_llm_fallback(models[0], model)
                return result
            except (APIError, APITimeoutError, APIConnectionError, RateLimitError) as e:
                last_exception = e
                record_llm_failure(model, type(e).__name__)
                logger.warning(f"{operation_name}: model {model} failed: {e}")
                if i < len(models) - 1:
                    logger.info(f"{operation_name}: falling back to next model...")
                continue
            except Exception as e:
                # 非网络/API 错误直接抛出
                raise e

        raise GeneratorError(f"{operation_name}: all models failed. Last error: {last_exception}")

    def validate_and_fix_citations(self, answer: str, num_sources: int) -> str:
        """
        验证并修正答案中的引用

        Args:
            answer: LLM 生成的答案
            num_sources: 实际可用的来源数量

        Returns:
            修正后的答案
        """
        if num_sources == 0:
            return answer

        # 提取所有引用编号
        citations = re.findall(r'\[(\d+)\]', answer)

        if not citations:
            return answer

        # 找出无效引用（超出范围）
        invalid_citations = set()
        for c in citations:
            num = int(c)
            if num > num_sources or num < 1:
                invalid_citations.add(num)

        if not invalid_citations:
            return answer

        # 修正无效引用：移除超出范围的引用标记
        fixed_answer = answer
        for invalid in invalid_citations:
            # 将无效引用替换为普通数字（移除方括号）
            fixed_answer = fixed_answer.replace(f'[{invalid}]', str(invalid))

        logger.info(f"Fixed {len(invalid_citations)} invalid citations: {invalid_citations}")
        return fixed_answer

    def generate_answer(
        self,
        question: str,
        contexts: List[str],
        history: Optional[List[Dict[str, str]]] = None,
        summary: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        web_contexts_count: int = 0
    ) -> str:
        """
        基于上下文生成答案（支持多轮对话）

        Args:
            question: 当前问题
            contexts: 检索到的相关文档（本地 + 网络）
            history: 历史对话 [{"role": "user/assistant", "content": "..."}]
            summary: 之前的对话摘要
            max_tokens: 最大生成token数
            temperature: 温度参数
            web_contexts_count: 网络搜索结果数量（用于区分编号）
        """
        # 构建上下文，本地来源用 [1]、[2]，网络来源用 [W1]、[W2]
        local_count = len(contexts) - web_contexts_count
        context_parts = []

        # 本地知识库来源
        for i, ctx in enumerate(contexts[:local_count]):
            context_parts.append(f"[{i+1}] {ctx}")

        # 网络搜索来源
        for i, ctx in enumerate(contexts[local_count:]):
            context_parts.append(f"[W{i+1}] {ctx}")

        context_text = "\n\n".join(context_parts)

        # 构建系统提示
        system_content = "你是一个专业的问答助手，善于基于提供的参考资料给出准确、有引用的答案。"
        if web_contexts_count > 0:
            system_content += f"本地知识库来源用[1]-[{local_count}]标注，网络搜索来源用[W1]-[W{web_contexts_count}]标注。请引用时注意区分。"
        else:
            system_content += "请在答案中标注引用来源，格式为[1]、[2]等。"

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

        def call_api(model: str):
            return self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )

        try:
            response = self._call_with_fallback(call_api, "generate_answer")
            answer = response.choices[0].message.content
            # 验证并修正引用
            return self.validate_and_fix_citations(answer, len(contexts))

        except GeneratorError:
            raise
        except Exception as e:
            logger.error(f"Failed to generate answer: {e}")
            raise GeneratorError(f"Failed to generate answer: {e}")

    def generate_answer_stream(
        self,
        question: str,
        contexts: List[str],
        history: Optional[List[Dict[str, str]]] = None,
        summary: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        web_contexts_count: int = 0
    ) -> TypeGenerator[str, None, None]:
        """
        流式生成答案（支持中断）

        注意：流式输出无法在生成过程中验证引用，需在前端或后端完成后处理

        Args:
            question: 当前问题
            contexts: 检索到的相关文档（本地 + 网络）
            history: 历史对话
            summary: 之前的对话摘要
            max_tokens: 最大生成token数
            temperature: 温度参数
            web_contexts_count: 网络搜索结果数量（用于区分编号）

        Yields:
            str: 生成的文本片段
        """
        # 构建上下文，本地来源用 [1]、[2]，网络来源用 [W1]、[W2]
        local_count = len(contexts) - web_contexts_count
        context_parts = []

        # 本地知识库来源
        for i, ctx in enumerate(contexts[:local_count]):
            context_parts.append(f"[{i+1}] {ctx}")

        # 网络搜索来源
        for i, ctx in enumerate(contexts[local_count:]):
            context_parts.append(f"[W{i+1}] {ctx}")

        context_text = "\n\n".join(context_parts)

        # 构建系统提示
        system_content = "你是一个专业的问答助手，善于基于提供的参考资料给出准确、有引用的答案。"
        if web_contexts_count > 0:
            system_content += f"本地知识库来源用[1]-[{local_count}]标注，网络搜索来源用[W1]-[W{web_contexts_count}]标注。请引用时注意区分。"
        else:
            system_content += "请在答案中标注引用来源，格式为[1]、[2]等。"

        if summary:
            system_content += f"\n\n以下是之前对话的摘要，请参考以保持对话连贯性：\n{summary}"

        # 构建消息列表
        messages = [{"role": "system", "content": system_content}]

        # 添加历史对话
        if history:
            recent_history = history[-12:] if len(history) > 12 else history
            for msg in recent_history:
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

        # 流式生成需要逐个尝试模型，成功后开始流式输出
        models = self._get_models_to_try()
        last_exception = None

        for i, model in enumerate(models):
            try:
                logger.info(f"generate_answer_stream: trying model {model} ({i + 1}/{len(models)})")
                stream = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stream=True
                )

                record_llm_call(model, "generate_answer_stream")
                if i > 0:
                    logger.info(f"generate_answer_stream: succeeded with fallback model {model}")
                    record_llm_fallback(models[0], model)

                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return  # 成功完成，退出

            except (APIError, APITimeoutError, APIConnectionError, RateLimitError) as e:
                last_exception = e
                record_llm_failure(model, type(e).__name__)
                logger.warning(f"generate_answer_stream: model {model} failed: {e}")
                if i < len(models) - 1:
                    logger.info(f"generate_answer_stream: falling back to next model...")
                continue
            except Exception as e:
                logger.error(f"Failed to generate answer stream: {e}")
                raise GeneratorError(f"Failed to generate answer stream: {e}")

        raise GeneratorError(f"generate_answer_stream: all models failed. Last error: {last_exception}")

    def generate_session_title(self, first_question: str) -> str:
        """
        根据第一个问题生成会话标题

        Args:
            first_question: 会话的第一个问题

        Returns:
            生成的标题
        """
        def call_api(model: str):
            return self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "请用5-10个字概括以下问题的主题，直接输出标题，不要其他内容。"},
                    {"role": "user", "content": first_question}
                ],
                max_tokens=20,
                temperature=0.3
            )

        try:
            response = self._call_with_fallback(call_api, "generate_session_title")
            return response.choices[0].message.content.strip()[:50]
        except Exception as e:
            logger.warning(f"Failed to generate title: {e}")
            # 返回问题的前20个字符作为标题
            return first_question[:20] + ("..." if len(first_question) > 20 else "")
