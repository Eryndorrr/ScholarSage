"""网络搜索基础类型定义"""

from dataclasses import dataclass, field
from typing import List, Optional
from abc import ABC, abstractmethod


@dataclass
class WebSearchResult:
    """单条搜索结果"""
    title: str
    url: str
    snippet: str  # 摘要/片段
    source: str = ""  # 来源标识（如网站名）


@dataclass
class WebSearchResponse:
    """搜索响应"""
    query: str
    results: List[WebSearchResult] = field(default_factory=list)
    success: bool = True
    error: Optional[str] = None
    provider: str = ""  # 使用的搜索引擎


class BaseSearcher(ABC):
    """搜索引擎基类"""

    @abstractmethod
    async def search(self, query: str, max_results: int = 5) -> WebSearchResponse:
        """执行搜索"""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """检查搜索引擎是否可用"""
        pass
