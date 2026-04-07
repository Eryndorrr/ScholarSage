"""
联网检索模块

支持 DuckDuckGo、Tavily 和 Bocha 三种搜索引擎
"""

from app.core.web_search.base import WebSearchResult, WebSearchResponse
from app.core.web_search.duckduckgo import DuckDuckGoSearcher
from app.core.web_search.tavily import TavilySearcher
from app.core.web_search.bocha import BochaSearcher
from app.core.web_search.searcher import WebSearcher, get_web_searcher

__all__ = [
    "WebSearchResult",
    "WebSearchResponse",
    "DuckDuckGoSearcher",
    "TavilySearcher",
    "BochaSearcher",
    "WebSearcher",
    "get_web_searcher",
]
