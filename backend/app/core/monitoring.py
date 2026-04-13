"""
可观测性模块：Prometheus 指标 + OpenTelemetry 链路追踪
"""
import logging
import time
from functools import wraps
from typing import Callable

from prometheus_client import Counter, Histogram, Gauge, Info
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource

from app.config import settings

logger = logging.getLogger(__name__)

# ========== Prometheus 自定义指标 ==========

# RAG 管道指标
rag_queries_total = Counter(
    "rag_queries_total",
    "Total number of RAG queries",
    ["has_web_search", "has_answer"]
)

rag_query_duration_seconds = Histogram(
    "rag_query_duration_seconds",
    "RAG query end-to-end duration in seconds",
    buckets=[0.5, 1, 2, 5, 10, 30, 60, 120]
)

rag_retrieval_duration_seconds = Histogram(
    "rag_retrieval_duration_seconds",
    "Document retrieval duration in seconds",
    ["use_hybrid", "use_rerank"]
)

rag_generation_duration_seconds = Histogram(
    "rag_llm_duration_seconds",
    "LLM answer generation duration in seconds",
    ["model", "stream"]
)

rag_sources_count = Histogram(
    "rag_sources_count",
    "Number of sources used per query",
    buckets=[1, 2, 3, 5, 10, 20]
)

rag_confidence_score = Histogram(
    "rag_confidence_score",
    "Query confidence score distribution",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# LLM 调用指标
llm_calls_total = Counter(
    "llm_calls_total",
    "Total LLM API calls",
    ["model", "operation"]
)

llm_calls_failed = Counter(
    "llm_calls_failed_total",
    "Failed LLM API calls",
    ["model", "error_type"]
)

llm_fallback_total = Counter(
    "llm_fallback_total",
    "Number of fallback model switches",
    ["from_model", "to_model"]
)

# 文档处理指标
documents_processed_total = Counter(
    "documents_processed_total",
    "Total documents processed",
    ["file_type", "status"]
)

documents_chunks_created = Counter(
    "documents_chunks_created_total",
    "Total chunks created from documents"
)

# 系统状态
app_info = Info(
    "scholar_sage",
    "Application info"
)

active_sessions = Gauge(
    "active_sessions",
    "Number of active sessions"
)


# ========== OpenTelemetry 追踪 ==========

_tracer = None


def setup_tracing():
    """初始化 OpenTelemetry 追踪"""
    global _tracer

    resource = Resource.create({
        "service.name": "scholar-sage",
        "service.version": "1.0.0"
    })

    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer("scholar-sage")

    logger.info("OpenTelemetry tracing initialized")


def get_tracer():
    """获取 tracer 实例"""
    global _tracer
    if _tracer is None:
        setup_tracing()
    return _tracer


def trace_operation(name: str):
    """
    追踪装饰器，为函数创建 span

    Usage:
        @trace_operation("retrieve_documents")
        def retrieve(...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_as_current_span(name) as span:
                span.set_attribute("function", func.__name__)
                try:
                    result = func(*args, **kwargs)
                    span.set_attribute("status", "ok")
                    return result
                except Exception as e:
                    span.set_attribute("status", "error")
                    span.set_attribute("error.type", type(e).__name__)
                    span.set_attribute("error.message", str(e))
                    raise
        return wrapper
    return decorator


def trace_async_operation(name: str):
    """
    异步追踪装饰器

    Usage:
        @trace_async_operation("web_search")
        async def search(...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_as_current_span(name) as span:
                span.set_attribute("function", func.__name__)
                try:
                    result = await func(*args, **kwargs)
                    span.set_attribute("status", "ok")
                    return result
                except Exception as e:
                    span.set_attribute("status", "error")
                    span.set_attribute("error.type", type(e).__name__)
                    span.set_attribute("error.message", str(e))
                    raise
        return wrapper
    return decorator


# ========== 辅助函数 ==========

def record_rag_query(
    duration: float,
    has_web_search: bool,
    has_answer: bool,
    confidence: float,
    sources_count: int,
    retrieval_duration: float = 0,
    generation_duration: float = 0,
    model: str = "",
    use_hybrid: bool = False,
    use_rerank: bool = False,
    stream: bool = False
):
    """记录一次 RAG 查询的所有指标"""
    rag_queries_total.labels(
        has_web_search=str(has_web_search),
        has_answer=str(has_answer)
    ).inc()

    rag_query_duration_seconds.observe(duration)
    rag_confidence_score.observe(confidence)
    rag_sources_count.observe(sources_count)

    if retrieval_duration > 0:
        rag_retrieval_duration_seconds.labels(
            use_hybrid=str(use_hybrid),
            use_rerank=str(use_rerank)
        ).observe(retrieval_duration)

    if generation_duration > 0:
        rag_generation_duration_seconds.labels(
            model=model or settings.openai_model,
            stream=str(stream)
        ).observe(generation_duration)


def record_llm_call(model: str, operation: str):
    """记录 LLM 调用"""
    llm_calls_total.labels(model=model, operation=operation).inc()


def record_llm_failure(model: str, error_type: str):
    """记录 LLM 调用失败"""
    llm_calls_failed.labels(model=model, error_type=error_type).inc()


def record_llm_fallback(from_model: str, to_model: str):
    """记录模型降级"""
    llm_fallback_total.labels(from_model=from_model, to_model=to_model).inc()


def setup_monitoring(app):
    """
    初始化所有监控组件

    Args:
        app: FastAPI 应用实例
    """
    # Prometheus FastAPI 自动指标（请求数、延迟、错误率等）
    from prometheus_fastapi_instrumentator import Instrumentator
    instrumentator = Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=["/metrics", "/health"]
    )
    instrumentator.instrument(app)
    instrumentator.expose(app, endpoint="/metrics", include_in_schema=True)

    # OpenTelemetry 追踪
    setup_tracing()

    # 应用信息
    app_info.info({
        "version": "1.0.0",
        "model": settings.openai_model
    })

    logger.info("Monitoring setup complete: Prometheus metrics at /metrics, OpenTelemetry tracing enabled")
