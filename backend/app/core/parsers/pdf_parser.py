from typing import List, Tuple
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

    def extract_text_by_pages(self) -> List[Tuple[int, str]]:
        """按页提取文本，返回 (页码, 文本) 列表"""
        pages = []
        for i, page in enumerate(self.reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append((i + 1, text.strip()))  # 页码从1开始
        return pages

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

        return [c for c in chunks if c and len(c) > 10]

    def chunk_text_with_pages(self, chunk_size: int = 512, overlap: int = 50) -> List[Tuple[str, int]]:
        """按页切分文本，返回 (文本块, 页码) 列表"""
        chunks_with_pages = []
        pages = self.extract_text_by_pages()

        for page_num, page_text in pages:
            # 按段落切分每页文本
            paragraphs = page_text.split('\n')
            current_chunk = ""

            for para in paragraphs:
                if len(current_chunk) + len(para) > chunk_size and current_chunk:
                    chunks_with_pages.append((current_chunk.strip(), page_num))
                    overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                    current_chunk = overlap_text + " " + para
                else:
                    current_chunk += " " + para if current_chunk else para

            if current_chunk:
                chunks_with_pages.append((current_chunk.strip(), page_num))

        return [(c, p) for c, p in chunks_with_pages if c and len(c) > 10]