"""
Bocha（博查）搜索引擎

国内可访问的搜索引擎 API
官网：https://bocha.io/
"""

import asyncio
import logging
from typing import List, Optional
import httpx
from app.core.web_search.base import BaseSearcher, WebSearchResult, WebSearchResponse

logger = logging.getLogger(__name__)


class BochaSearcher(BaseSearcher):
    """Bocha 搜索器"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.base_url = "https://api.bocha.io/v1/web-search"

    def is_available(self) -> bool:
        """检查 Bocha 是否可用"""
        if not self.api_key:
            logger.warning("Bocha API Key 未配置")
            return False
        return True

    async def search(self, query: str, max_results: int = 5) -> WebSearchResponse:
        """执行 Bocha 搜索"""
        if not self.api_key:
            return WebSearchResponse(
                query=query,
                results=[],
                success=False,
                error="Bocha API Key 未配置",
                provider="bocha"
            )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "query": query,
                        "count": max_results
                    }
                )

                if response.status_code != 200:
                    error_msg = f"Bocha API 错误: {response.status_code}"
                    try:
                        error_data = response.json()
                        if "message" in error_data:
                            error_msg = error_data["message"]
                    except:
                        pass
                    logger.error(error_msg)
                    return WebSearchResponse(
                        query=query,
                        results=[],
                        success=False,
                        error=error_msg,
                        provider="bocha"
                    )

                data = response.json()
                search_results: List[WebSearchResult] = []

                # 解析 Bocha 返回结果
                web_pages = data.get("webPages", {}).get("value", [])
                for item in web_pages[:max_results]:
                    search_results.append(WebSearchResult(
                        title=item.get("name", ""),
                        url=item.get("url", ""),
                        snippet=item.get("snippet", "") or item.get("description", ""),
                        source=self._extract_source(item.get("url", ""))
                    ))

                logger.info(f"Bocha 搜索成功，返回 {len(search_results)} 条结果")
                return WebSearchResponse(
                    query=query,
                    results=search_results,
                    success=True,
                    provider="bocha"
                )

        except httpx.TimeoutException:
            logger.error("Bocha 搜索超时")
            return WebSearchResponse(
                query=query,
                results=[],
                success=False,
                error="搜索超时",
                provider="bocha"
            )
        except Exception as e:
            logger.error(f"Bocha 搜索失败: {e}")
            return WebSearchResponse(
                query=query,
                results=[],
                success=False,
                error=str(e),
                provider="bocha"
            )

    def _extract_source(self, url: str) -> str:
        """从 URL 提取来源"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace("www.", "")
        except:
            return ""
