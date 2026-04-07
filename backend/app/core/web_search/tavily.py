"""
Tavily 搜索引擎

专为 AI 设计的搜索 API，返回结构化结果
免费额度：1000 次/月
"""

import asyncio
import logging
from typing import List, Optional
from app.core.web_search.base import BaseSearcher, WebSearchResult, WebSearchResponse

logger = logging.getLogger(__name__)


class TavilySearcher(BaseSearcher):
    """Tavily 搜索器"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self._client = None

    def _get_client(self):
        """延迟加载 Tavily 客户端"""
        if self._client is None:
            if not self.api_key:
                raise ValueError("Tavily API Key 未配置")
            try:
                from tavily import TavilyClient
                self._client = TavilyClient(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "请安装 tavily-python: pip install tavily-python"
                )
        return self._client

    def is_available(self) -> bool:
        """检查 Tavily 是否可用"""
        if not self.api_key:
            logger.warning("Tavily API Key 未配置")
            return False
        try:
            from tavily import TavilyClient
            return True
        except ImportError:
            logger.warning("tavily-python 未安装，请运行: pip install tavily-python")
            return False

    async def search(self, query: str, max_results: int = 5) -> WebSearchResponse:
        """执行 Tavily 搜索"""
        try:
            client = self._get_client()

            # 在线程池中执行同步搜索
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.search(
                    query=query,
                    max_results=max_results,
                    include_answer=False,  # 不需要 AI 总结
                    include_raw_content=False,
                )
            )

            search_results: List[WebSearchResult] = []
            for r in response.get("results", []):
                search_results.append(WebSearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=r.get("content", ""),
                    source=self._extract_source(r.get("url", ""))
                ))

            return WebSearchResponse(
                query=query,
                results=search_results,
                success=True,
                provider="tavily"
            )

        except Exception as e:
            logger.error(f"Tavily 搜索失败: {e}")
            return WebSearchResponse(
                query=query,
                results=[],
                success=False,
                error=str(e),
                provider="tavily"
            )

    def _extract_source(self, url: str) -> str:
        """从 URL 提取来源"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace("www.", "")
        except:
            return ""
