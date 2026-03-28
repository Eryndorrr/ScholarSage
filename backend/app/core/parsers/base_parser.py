from abc import ABC, abstractmethod
from typing import List


class BaseParser(ABC):
    """文档解析器基类"""

    @abstractmethod
    def extract_text(self) -> str:
        """提取文本内容"""
        pass

    @abstractmethod
    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """切分文本"""
        pass