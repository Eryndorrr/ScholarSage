from typing import List
from app.core.parsers.base_parser import BaseParser


class MarkdownParser(BaseParser):
    """Markdown文档解析器"""

    def __init__(self, content: str):
        self.content = content

    def extract_text(self) -> str:
        """提取Markdown文本（简单实现，保留原始内容）"""
        return self.content.strip()

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落切分Markdown文本"""
        paragraphs = self.content.split('\n\n')
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                # 保留overlap部分
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

        if current_chunk:
            chunks.append(current_chunk.strip())

        return [c for c in chunks if c]  # 过滤空字符串