from typing import List
from app.core.parsers.base_parser import BaseParser


class WordParser(BaseParser):
    """Word文档解析器"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.content = self._load_docx()

    def _load_docx(self) -> str:
        """加载Word文档"""
        try:
            from docx import Document
            doc = Document(self.file_path)
            return "\n".join([para.text for para in doc.paragraphs])
        except FileNotFoundError:
            raise FileNotFoundError(f"Word文件不存在: {self.file_path}")

    def extract_text(self) -> str:
        """提取Word文档全部文本"""
        return self.content.strip()

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落切分Word文本"""
        paragraphs = self.content.split('\n')
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + "\n" + para
            else:
                current_chunk += "\n" + para if current_chunk else para

        if current_chunk:
            chunks.append(current_chunk.strip())

        return [c for c in chunks if c]