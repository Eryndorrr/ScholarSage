"""
论文解析器 - 从学术论文PDF中提取元数据和引用
使用 PyMuPDF4LLM 优化文本提取
"""
import re
from typing import List, Dict, Optional
import fitz  # PyMuPDF
import pymupdf4llm
from app.core.parsers.base_parser import BaseParser


class PaperParser(BaseParser):
    """学术论文解析器 - 提取元数据和引用"""

    # 作者名模式
    AUTHOR_PATTERNS = [
        r"([A-Z][a-z]+ [A-Z][a-z]+)",  # First Last
        r"([A-Z]\. [A-Z][a-z]+)",  # F. Last
        r"([A-Z][a-z]+, [A-Z]\.?)",  # Last, F.
    ]

    # 摘要标记
    ABSTRACT_MARKERS = [
        (r"Abstract[:\s]*", r"\n\n[0-9IV]+\s|\n\n[A-Z][a-z]+|\n\nKeywords"),
        (r"ABSTRACT[:\s]*", r"\n\n[0-9IV]+\s|\n\n[A-Z][a-z]+|\n\nKEYWORDS"),
    ]

    # 关键词标记
    KEYWORD_MARKERS = [
        r"Keywords?[:\s]*(.+?)(?=\n\n|\n[0-9IV]+|\n[A-Z][a-z]+)",
        r"KEYWORDS?[:\s]*(.+?)(?=\n\n|\n[0-9IV]+|\n[A-Z][a-z]+)",
        r"Index Terms[:\s]*(.+?)(?=\n\n|\n[0-9IV]+)",
    ]

    # 引用标记
    REFERENCE_MARKERS = [
        r"References?\s*$",
        r"Bibliography\s*$",
        r"REFERENCES?\s*$",
    ]

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._doc = None
        self._text_cache: Optional[str] = None
        self._markdown_cache: Optional[str] = None
        self._pages: List[str] = []

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

        self._markdown_cache = pymupdf4llm.to_markdown(self.file_path)
        return self._markdown_cache

    def extract_page_texts(self) -> List[str]:
        """提取每页文本"""
        if not self._pages:
            self.extract_text()
        return self._pages

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落和大小切分文本（使用Markdown格式获得更好的结构）"""
        md_text = self.extract_markdown()
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

    def parse_paper_metadata(self) -> Dict:
        """解析论文元数据"""
        # 优先使用 Markdown 格式提取，结构更清晰
        md_text = self.extract_markdown()
        text = self.extract_text()
        pages = self.extract_page_texts()

        # 通常标题和作者在第一页
        first_page = pages[0] if pages else ""
        if not first_page:
            first_page = text

        return {
            "title": self._extract_title(first_page),
            "authors": self._extract_authors(first_page),
            "abstract": self._extract_abstract(md_text) or self._extract_abstract(text),
            "keywords": self._extract_keywords(md_text) or self._extract_keywords(text),
            "publication_year": self._extract_year(text),
        }

    def _extract_title(self, text: str) -> Optional[str]:
        """从文本中提取标题"""
        if not text:
            return None
        lines = text.split('\n')

        # 标题通常在前几行
        for i, line in enumerate(lines[:10]):
            line = line.strip()
            if not line:
                continue

            # 跳过可能的header（如会议名、页码等）
            if re.match(r'^[\d\-]+$', line):  # 纯数字或页码
                continue
            if re.match(r'^[A-Z]{2,}\s*$', line):  # 纯大写缩写
                continue

            # 标题特征：有一定长度，首字母大写
            if len(line) > 10 and len(line) < 200:
                # 检查是否像标题
                words = line.split()
                if len(words) >= 3 and not line.endswith('.'):
                    return line

        return None

    def _extract_authors(self, text: str) -> List[str]:
        """从文本中提取作者列表"""
        if not text:
            return []
        lines = text.split('\n')
        authors = []

        # 作者通常在标题之后、摘要之前
        in_author_section = False

        for i, line in enumerate(lines[:30]):  # 只看前30行
            line = line.strip()

            # 遇到摘要标记，停止
            if re.search(r'Abstract[:\s]*$', line, re.IGNORECASE):
                break

            # 跳过可能的标题
            if i < 3 and len(line) > 20:
                continue

            # 尝试匹配作者模式
            for pattern in self.AUTHOR_PATTERNS:
                matches = re.findall(pattern, line)
                if matches:
                    authors.extend(matches)
                    in_author_section = True

            # 也尝试用逗号分隔的名字
            if ',' in line and not authors:
                parts = line.split(',')
                for part in parts:
                    part = part.strip()
                    if re.match(r'^[A-Z][a-z]+ [A-Z]', part):
                        authors.append(part)

        # 去重并保持顺序
        seen = set()
        unique_authors = []
        for a in authors:
            if a not in seen and len(a) > 3:
                seen.add(a)
                unique_authors.append(a)

        return unique_authors[:10]  # 最多10个作者

    def _extract_abstract(self, text: str) -> Optional[str]:
        """从文本中提取摘要"""
        if not text:
            return None
        for start_pattern, end_pattern in self.ABSTRACT_MARKERS:
            match = re.search(
                start_pattern + r"(.*?)" + end_pattern,
                text,
                re.DOTALL | re.IGNORECASE
            )
            if match:
                abstract_content = match.group(1)
                if abstract_content is None:
                    continue
                abstract = abstract_content.strip()
                # 清理摘要
                abstract = re.sub(r'\s+', ' ', abstract)
                if len(abstract) > 50:  # 至少50字符
                    return abstract

        return None

    def _extract_keywords(self, text: str) -> List[str]:
        """从文本中提取关键词"""
        if not text:
            return []
        for pattern in self.KEYWORD_MARKERS:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                keywords_str = match.group(1)
                if keywords_str is None:
                    continue
                keywords_str = keywords_str.strip()
                # 分割关键词
                keywords = re.split(r'[,;·]\s*', keywords_str)
                # 清理
                keywords = [k.strip() for k in keywords if k.strip() and len(k.strip()) > 1]
                return keywords[:10]  # 最多10个关键词

        return []

    def _extract_year(self, text: str) -> Optional[int]:
        """从文本中提取发表年份"""
        if not text:
            return None
        # 查找常见年份模式
        patterns = [
            r'\b(19|20)\d{2}\b',  # 1900-2099
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text)
            if matches:
                # 取最近的有效年份
                years = [int(y) for y in matches]
                valid_years = [y for y in years if 1990 <= y <= 2030]
                if valid_years:
                    return max(valid_years)

        return None

    def extract_references(self) -> List[Dict]:
        """提取参考文献列表"""
        text = self.extract_text()
        references = []

        # 查找References部分
        ref_start = None
        for pattern in self.REFERENCE_MARKERS:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                ref_start = match.end()
                break

        if ref_start is None:
            return []

        ref_text = text[ref_start:].strip()

        # 尝试解析每条引用
        # 常见格式：[1] Author, Title, Venue, Year.
        # 或：1. Author, Title, Venue, Year.
        ref_patterns = [
            r'\[(\d+)\]\s*(.+?)(?=\[\d+\]|\Z)',  # [1] format
            r'(\d+)\.\s*(.+?)(?=\n\d+\.|\Z)',  # 1. format
        ]

        for pattern in ref_patterns:
            matches = re.findall(pattern, ref_text, re.DOTALL)
            for num, content in matches:
                ref_info = self._parse_reference(content.strip())
                if ref_info:
                    ref_info['ref_number'] = int(num)
                    references.append(ref_info)
            if references:
                break

        return references

    def _parse_reference(self, ref_text: str) -> Optional[Dict]:
        """解析单条引用"""
        if len(ref_text) < 20:  # 太短
            return None

        result = {}

        # 尝试提取年份
        year_match = re.search(r'\b(19|20)\d{2}\b', ref_text)
        if year_match:
            result['year'] = int(year_match.group())

        # 尝试提取标题（通常在引号中或句首）
        title_match = re.search(r'"([^"]+)"', ref_text)
        if title_match:
            result['title'] = title_match.group(1)
        else:
            # 尝试其他格式
            parts = ref_text.split('.')
            if len(parts) >= 2:
                result['title'] = parts[0].strip()

        # 尝试提取作者
        author_match = re.match(r'^([A-Z][a-z]+(?:,?\s+[A-Z](?:\.|\w)*(?:,?\s+and\s+)?)+)', ref_text)
        if author_match:
            authors_str = author_match.group(1)
            # 解析作者列表
            authors_str = re.sub(r'\s+and\s+', ', ', authors_str)
            authors = [a.strip() for a in re.split(r',\s*', authors_str) if a.strip()]
            result['authors'] = authors[:5]  # 最多5个作者

        # 尝试提取venue
        venue_patterns = [
            r'In\s+([A-Z][^,]+)',  # In Venue Name
            r'(?:Proceedings|Journal)\s+of\s+([^,]+)',  # Proceedings/Journal of ...
        ]
        for pattern in venue_patterns:
            match = re.search(pattern, ref_text)
            if match:
                result['venue'] = match.group(1).strip()
                break

        return result if result else None

    def generate_bibtex(
        self,
        title: str,
        authors: List[str],
        year: Optional[int] = None,
        venue: Optional[str] = None,
        doi: Optional[str] = None
    ) -> str:
        """生成BibTeX条目"""
        # 生成citation key
        first_author = authors[0] if authors else "Unknown"
        last_name = first_author.split()[-1] if first_author else "Unknown"
        year_str = str(year) if year else "n.d."
        cite_key = f"{last_name}{year_str}".replace(" ", "")

        # 确定类型
        entry_type = "inproceedings" if venue else "article"

        # 构建BibTeX
        lines = [f"@{entry_type}{{{cite_key},"]
        lines.append(f"  title = {{{title}}},")

        if authors:
            authors_str = " and ".join(authors)
            lines.append(f"  author = {{{authors_str}}},")

        if year:
            lines.append(f"  year = {{{year}}},")

        if venue:
            if entry_type == "inproceedings":
                lines.append(f"  booktitle = {{{venue}}},")
            else:
                lines.append(f"  journal = {{{venue}}},")

        if doi:
            lines.append(f"  doi = {{{doi}}},")

        lines.append("}")
        return "\n".join(lines)

    def parse_all(self) -> Dict:
        """解析论文全部信息"""
        metadata = self.parse_paper_metadata()
        references = self.extract_references()

        return {
            **metadata,
            "references": references,
        }

    def __del__(self):
        """关闭文档"""
        if self._doc:
            self._doc.close()
