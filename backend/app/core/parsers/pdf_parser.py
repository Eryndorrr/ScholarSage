"""
PDF文档解析器 - 使用 PyMuPDF4LLM 优化 LLM/RAG 场景
"""
from typing import List, Tuple
import pymupdf4llm
import fitz  # PyMuPDF
from app.core.parsers.base_parser import BaseParser


class PDFParser(BaseParser):
    """PDF文档解析器 - 优化 LLM/RAG 输出"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._doc = None
        self._text_cache = None
        self._markdown_cache = None
        self._pages = []

    def _load_pdf(self):
        """加载PDF文件"""
        if self._doc is None:
            try:
                self._doc = fitz.open(self.file_path)
            except Exception as e:
                raise FileNotFoundError(f"PDF文件不存在或无法打开: {self.file_path}, 错误: {e}")
        return self._doc

    def extract_text(self) -> str:
        """提取PDF全部文本（纯文本格式）"""
        if self._text_cache is not None:
            return self._text_cache

        doc = self._load_pdf()
        self._pages = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            self._pages.append(text)

        self._text_cache = "\n\n".join(self._pages)
        return self._text_cache

    def extract_markdown(self) -> str:
        """提取PDF为Markdown格式（适合 LLM/RAG）"""
        if self._markdown_cache is not None:
            return self._markdown_cache

        # 使用 pymupdf4llm 提取 Markdown
        self._markdown_cache = pymupdf4llm.to_markdown(self.file_path)
        return self._markdown_cache

    def extract_text_by_pages(self) -> List[Tuple[int, str]]:
        """按页提取文本，返回 (页码, 文本) 列表"""
        doc = self._load_pdf()
        pages = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            if text.strip():
                pages.append((page_num + 1, text.strip()))  # 页码从1开始

        return pages

    def extract_markdown_by_pages(self) -> List[Tuple[int, str]]:
        """按页提取Markdown文本，返回 (页码, markdown) 列表"""
        doc = self._load_pdf()
        pages = []

        for page_num in range(len(doc)):
            # 使用 pymupdf4llm 按页提取
            md_text = pymupdf4llm.to_markdown(self.file_path, pages=[page_num])
            if md_text.strip():
                pages.append((page_num + 1, md_text.strip()))

        return pages

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落和大小切分PDF文本（使用Markdown格式）"""
        # 优先使用 Markdown 格式
        md_text = self.extract_markdown()

        # 按段落切分（Markdown 段落以双换行分隔）
        paragraphs = md_text.split('\n\n')
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

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
                para = para.strip()
                if not para:
                    continue

                if len(current_chunk) + len(para) > chunk_size and current_chunk:
                    chunks_with_pages.append((current_chunk.strip(), page_num))
                    overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                    current_chunk = overlap_text + " " + para
                else:
                    current_chunk += " " + para if current_chunk else para

            if current_chunk:
                chunks_with_pages.append((current_chunk.strip(), page_num))

        return [(c, p) for c, p in chunks_with_pages if c and len(c) > 10]

    def get_page_count(self) -> int:
        """获取PDF页数"""
        doc = self._load_pdf()
        return len(doc)

    def extract_images_info(self) -> List[dict]:
        """提取PDF中的图片信息"""
        doc = self._load_pdf()
        images = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images()

            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                images.append({
                    'page': page_num + 1,
                    'index': img_index,
                    'width': base_image['width'],
                    'height': base_image['height'],
                    'colorspace': base_image.get('colorspace', 'unknown'),
                    'xref': xref
                })

        return images

    def extract_tables_info(self) -> List[dict]:
        """提取PDF中的表格信息（使用 PyMuPDF 的表格检测）"""
        doc = self._load_pdf()
        tables = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            # PyMuPDF 的表格检测
            tabs = page.find_tables()
            if tabs.tables:
                for tab in tabs.tables:
                    tables.append({
                        'page': page_num + 1,
                        'bbox': tab.bbox,  # (x0, y0, x1, y1)
                        'row_count': tab.row_count,
                        'col_count': tab.col_count,
                    })

        return tables

    def __del__(self):
        """关闭文档"""
        if self._doc:
            self._doc.close()
