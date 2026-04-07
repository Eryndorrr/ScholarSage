"""
统一网络搜索器

根据配置选择搜索引擎
"""

import logging
from typing import Optional
from app.config import settings
from app.core.web_search.base import BaseSearcher, WebSearchResponse
from app.core.web_search.duckduckgo import DuckDuckGoSearcher
from app.core.web_search.tavily import TavilySearcher

logger = logging.getLogger(__name__)


class WebSearcher:
    """统一网络搜索器"""

    def __init__(
        self,
        provider: Optional[str] = None,
        tavily_api_key: Optional[str] = None
    ):
        self.provider = provider or settings.web_search_provider
        self.tavily_api_key = tavily_api_key or settings.tavily_api_key
        self._searcher: Optional[BaseSearcher] = None

    def _get_searcher(self) -> BaseSearcher:
        """获取搜索引擎实例"""
        if self._searcher is not None:
            return self._searcher

        if self.provider == "tavily":
            if not self.tavily_api_key:
                logger.warning("Tavily API Key 未配置，回退到 DuckDuckGo")
                self._searcher = DuckDuckGoSearcher()
                self.provider = "duckduckgo"
            else:
                self._searcher = TavilySearcher(api_key=self.tavily_api_key)
        else:
            # 默认使用 DuckDuckGo
            self._searcher = DuckDuckGoSearcher()

        return self._searcher

    def is_available(self) -> bool:
        """检查搜索引擎是否可用"""
        # 检查全局开关
        if not settings.web_search_enabled:
            logger.info("联网检索功能已禁用")
            return False

        searcher = self._get_searcher()
        return searcher.is_available()

    async def search(
        self,
        query: str,
        max_results: Optional[int] = None
    ) -> WebSearchResponse:
        """
        执行网络搜索

        Args:
            query: 搜索查询
            max_results: 最大结果数，默认使用配置值

        Returns:
            WebSearchResponse: 搜索响应
        """
        if max_results is None:
            max_results = settings.web_search_max_results

        searcher = self._get_searcher()

        if not searcher.is_available():
            return WebSearchResponse(
                query=query,
                results=[],
                success=False,
                error="搜索引擎不可用",
                provider=self.provider
            )

        logger.info(f"使用 {self.provider} 执行搜索: {query}")
        return await searcher.search(query, max_results)

    def format_results_for_context(self, response: WebSearchResponse) -> str:
        """
        将搜索结果格式化为上下文字符串

        用于注入到 RAG 的上下文中
        """
        if not response.success or not response.results:
            return ""

        lines = ["## 网络搜索结果\n"]
        for i, result in enumerate(response.results, 1):
            lines.append(f"### [{result.title}]({result.url})")
            if result.source:
                lines.append(f"来源: {result.source}")
            lines.append(f"{result.snippet}\n")

        return "\n".join(lines)


# 单例实例
_web_searcher: Optional[WebSearcher] = None


def get_web_searcher() -> WebSearcher:
    """获取网络搜索器单例"""
    global _web_searcher
    if _web_searcher is None:
        _web_searcher = WebSearcher()
    return _web_searcher
