"""
DuckDuckGo 搜索引擎

免费、无需 API Key
"""

import asyncio
import logging
from typing import List
from app.core.web_search.base import BaseSearcher, WebSearchResult, WebSearchResponse

logger = logging.getLogger(__name__)


class DuckDuckGoSearcher(BaseSearcher):
    """DuckDuckGo 搜索器"""

    def __init__(self):
        self._ddgs = None

    def _get_ddgs(self):
        """延迟加载 duckduckgo_search"""
        if self._ddgs is None:
            try:
                from duckduckgo_search import DDGS
                self._ddgs = DDGS()
            except ImportError:
                raise ImportError(
                    "请安装 duckduckgo-search: pip install duckduckgo-search"
                )
        return self._ddgs

    def is_available(self) -> bool:
        """检查 DuckDuckGo 是否可用"""
        try:
            from duckduckgo_search import DDGS
            return True
        except ImportError:
            logger.warning("duckduckgo-search 未安装，请运行: pip install duckduckgo-search")
            return False

    async def search(self, query: str, max_results: int = 5) -> WebSearchResponse:
        """执行 DuckDuckGo 搜索"""
        try:
            ddgs = self._get_ddgs()

            # 在线程池中执行同步搜索
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None,
                lambda: list(ddgs.text(query, max_results=max_results))
            )

            search_results: List[WebSearchResult] = []
            for r in results:
                search_results.append(WebSearchResult(
                    title=r.get("title", ""),
                    url=r.get("href", ""),
                    snippet=r.get("body", ""),
                    source=self._extract_source(r.get("href", ""))
                ))

            return WebSearchResponse(
                query=query,
                results=search_results,
                success=True,
                provider="duckduckgo"
            )

        except Exception as e:
            logger.error(f"DuckDuckGo 搜索失败: {e}")
            return WebSearchResponse(
                query=query,
                results=[],
                success=False,
                error=str(e),
                provider="duckduckgo"
            )

    def _extract_source(self, url: str) -> str:
        """从 URL 提取来源"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace("www.", "")
        except:
            return ""
