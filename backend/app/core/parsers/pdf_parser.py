from typing import List
from pypdf import PdfReader
from app.core.parsers.base_parser import BaseParser


class PDFParser(BaseParser):
    """PDF文档解析器"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.reader = self._load_pdf()

    def _load_pdf(self) -> PdfReader:
        """加载PDF文件"""
        try:
            return PdfReader(self.file_path)
        except FileNotFoundError:
            raise FileNotFoundError(f"PDF文件不存在: {self.file_path}")

    def extract_text(self) -> str:
        """提取PDF全部文本"""
        text = ""
        for page in self.reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落和大小切分PDF文本"""
        full_text = self.extract_text()
        paragraphs = full_text.split('\n')
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                current_chunk = overlap_text + " " + para
            else:
                current_chunk += " " + para if current_chunk else para

        if current_chunk:
            chunks.append(current_chunk.strip())

        return [c for c in chunks if c and len(c) > 10]  # 过滤过短的片段