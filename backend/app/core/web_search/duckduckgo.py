"""
DuckDuckGo 搜索引擎

免费、无需 API Key
使用 ddgs 包（duckduckgo_search 的新名称）
"""

import asyncio
import logging
from typing import List, Optional
from app.core.web_search.base import BaseSearcher, WebSearchResult, WebSearchResponse

logger = logging.getLogger(__name__)


class DuckDuckGoSearcher(BaseSearcher):
    """DuckDuckGo 搜索器"""

    def __init__(self, proxy: Optional[str] = None):
        self._ddgs = None
        self._proxy = proxy

    def _get_ddgs(self):
        """延迟加载 ddgs"""
        if self._ddgs is None:
            try:
                # 优先使用新包名 ddgs
                try:
                    from ddgs import DDGS
                    self._ddgs = DDGS(proxy=self._proxy)
                    logger.debug("使用 ddgs 包")
                except ImportError:
                    # 回退到旧包名
                    from duckduckgo_search import DDGS
                    self._ddgs = DDGS(proxy=self._proxy)
                    logger.debug("使用 duckduckgo_search 包")
            except ImportError:
                raise ImportError(
                    "请安装 ddgs: pip install ddgs"
                )
        return self._ddgs

    def is_available(self) -> bool:
        """检查 DuckDuckGo 是否可用"""
        try:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS
            return True
        except ImportError:
            logger.warning("ddgs 未安装，请运行: pip install ddgs")
            return False

    async def search(self, query: str, max_results: int = 5) -> WebSearchResponse:
        """执行 DuckDuckGo 搜索"""
        try:
            ddgs = self._get_ddgs()

            def do_search():
                """在同步上下文中执行搜索"""
                try:
                    # 使用 text 搜索
                    results = list(ddgs.text(
                        query,
                        max_results=max_results
                    ))
                    return results
                except Exception as e:
                    logger.error(f"DuckDuckGo 搜索异常: {e}")
                    raise

            # 在线程池中执行同步搜索
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(None, do_search)

            search_results: List[WebSearchResult] = []
            for r in results:
                search_results.append(WebSearchResult(
                    title=r.get("title", ""),
                    url=r.get("href", "") or r.get("url", ""),
                    snippet=r.get("body", "") or r.get("description", ""),
                    source=self._extract_source(r.get("href", "") or r.get("url", ""))
                ))

            logger.info(f"DuckDuckGo 搜索成功，返回 {len(search_results)} 条结果")
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
