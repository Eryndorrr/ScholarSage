"""
LLM 论文解析器 - 使用大模型提取论文元数据
"""
from typing import Dict, List, Optional
import json
import re
import fitz  # PyMuPDF
import pymupdf4llm
from openai import OpenAI
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class LLMPaperParser:
    """使用 LLM 解析学术论文元数据"""

    EXTRACTION_PROMPT = """你是一个学术论文元数据提取专家。请从以下论文文本中提取结构化信息。

论文文本：
{paper_text}

请提取以下信息并以 JSON 格式返回：
1. title: 论文标题
2. authors: 作者列表（数组）
3. abstract: 摘要
4. keywords: 关键词列表（数组）
5. publication_year: 发表年份（数字）
6. venue: 发表会议或期刊名称

返回格式示例：
{{
    "title": "论文标题",
    "authors": ["作者1", "作者2"],
    "abstract": "摘要内容...",
    "keywords": ["关键词1", "关键词2"],
    "publication_year": 2024,
    "venue": "会议或期刊名称"
}}

注意：
- 如果某项信息无法提取，设为 null
- 作者姓名需要清理，只保留真实姓名，不要包含机构或特殊符号
- 年份只返回数字
- 关键词如果没有明确标注，可以从摘要或正文中推断
- 只返回 JSON，不要有其他内容"""

    REFERENCE_EXTRACTION_PROMPT = """你是一个学术参考文献提取专家。请从以下参考文献部分提取所有引用信息。

参考文献文本：
{reference_text}

请提取每条引用的信息，以 JSON 格式返回，包含 references 数组：
{{
    "references": [
        {{
            "title": "论文标题",
            "authors": ["作者1", "作者2"],
            "year": 2024,
            "venue": "会议或期刊名称"
        }}
    ]
}}

注意：
- 如果某项信息无法提取，设为 null
- 只返回 JSON 对象，不要有其他内容
- 必须包含 references 数组字段"""

    def __init__(self, api_key: str = None, model: str = None, base_url: str = None):
        self.client = OpenAI(
            api_key=api_key or settings.openai_api_key,
            base_url=base_url or settings.openai_base_url
        )
        self.model = model or settings.openai_model
        self._doc = None
        self._file_path = None

    def _load_pdf(self, file_path: str):
        """加载 PDF 文件"""
        if self._doc is None or self._file_path != file_path:
            if self._doc:
                self._doc.close()
            try:
                self._doc = fitz.open(file_path)
                self._file_path = file_path
            except Exception as e:
                raise FileNotFoundError(f"PDF 文件不存在或无法打开: {file_path}, 错误: {e}")
        return self._doc

    def _extract_front_matter(self, file_path: str, max_pages: int = 3) -> str:
        """提取论文前面部分（标题、作者、摘要等）"""
        doc = self._load_pdf(file_path)
        text_parts = []

        for page_num in range(min(max_pages, len(doc))):
            page = doc[page_num]
            text = page.get_text()
            text_parts.append(text)

        return "\n\n".join(text_parts)

    def _extract_references_section(self, file_path: str) -> str:
        """提取参考文献部分（支持多页）"""
        doc = self._load_pdf(file_path)

        # 从后向前查找参考文献部分的起始页
        ref_start_page = None
        ref_start_pos = None

        for page_num in range(len(doc) - 1, -1, -1):
            page = doc[page_num]
            text = page.get_text()

            # 检查是否包含参考文献标记
            if re.search(r'References?\s*$', text, re.IGNORECASE | re.MULTILINE):
                match = re.search(r'References?\s*\n', text, re.IGNORECASE)
                if match:
                    ref_start_page = page_num
                    ref_start_pos = match.end()
                    logger.info(f"Found references section on page {page_num + 1}")
                    break

        if ref_start_page is None:
            logger.warning(f"No references section found in {file_path}")
            return ""

        # 从参考文献起始位置到文档末尾，提取所有文本
        text_parts = []

        # 第一页：从 References 标记之后开始
        first_page = doc[ref_start_page]
        first_text = first_page.get_text()
        text_parts.append(first_text[ref_start_pos:])

        # 后续所有页
        for page_num in range(ref_start_page + 1, len(doc)):
            page = doc[page_num]
            text_parts.append(page.get_text())

        full_ref_text = "\n\n".join(text_parts)
        logger.info(f"Extracted references text: {len(full_ref_text)} characters across {len(doc) - ref_start_page} pages")

        return full_ref_text

    def _call_llm(self, prompt: str, max_tokens: int = 2000, temperature: float = 0.1) -> str:
        """调用 LLM API"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个学术论文元数据提取专家，只返回 JSON 格式的结果。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                response_format={"type": "json_object"}  # 强制 JSON 输出
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM API call failed: {e}")
            raise

    def _parse_json_response(self, response: str) -> Dict:
        """解析 LLM 返回的 JSON"""
        try:
            # 尝试直接解析
            return json.loads(response)
        except json.JSONDecodeError:
            # 尝试提取 JSON 部分
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
            return {}

    def parse_paper_metadata(self, file_path: str) -> Dict:
        """
        使用 LLM 解析论文元数据

        Args:
            file_path: PDF 文件路径

        Returns:
            包含 title, authors, abstract, keywords, publication_year, venue 的字典
        """
        # 1. 提取前面部分文本
        front_matter = self._extract_front_matter(file_path, max_pages=3)

        if not front_matter.strip():
            return {
                "title": None,
                "authors": [],
                "abstract": None,
                "keywords": [],
                "publication_year": None,
                "venue": None
            }

        # 2. 调用 LLM 提取元数据
        prompt = self.EXTRACTION_PROMPT.format(paper_text=front_matter[:6000])  # 限制长度

        try:
            response = self._call_llm(prompt)
            metadata = self._parse_json_response(response)

            # 确保 authors 和 keywords 是列表
            if metadata.get("authors") is None:
                metadata["authors"] = []
            elif isinstance(metadata.get("authors"), str):
                metadata["authors"] = [a.strip() for a in metadata["authors"].split(",")]

            if metadata.get("keywords") is None:
                metadata["keywords"] = []
            elif isinstance(metadata.get("keywords"), str):
                metadata["keywords"] = [k.strip() for k in metadata["keywords"].split(",")]

            return metadata

        except Exception as e:
            logger.error(f"Failed to parse paper metadata with LLM: {e}")
            return {
                "title": None,
                "authors": [],
                "abstract": None,
                "keywords": [],
                "publication_year": None,
                "venue": None
            }

    def extract_references(self, file_path: str) -> List[Dict]:
        """
        使用 LLM 提取参考文献（支持分块处理长文本）

        Args:
            file_path: PDF 文件路径

        Returns:
            参考文献 列表
        """
        # 1. 提取参考文献部分
        ref_text = self._extract_references_section(file_path)

        if not ref_text.strip():
            logger.warning(f"No references section found in {file_path}")
            return []

        # 2. 如果文本较短，直接处理（放宽到 20000 字符）
        if len(ref_text) <= 20000:
            return self._extract_references_single(ref_text)

        # 3. 如果文本较长，分块处理
        logger.info(f"References text is long ({len(ref_text)} chars), processing in chunks")
        return self._extract_references_chunked(ref_text)

    def _extract_references_single(self, ref_text: str) -> List[Dict]:
        """单次 LLM 调用提取参考文献"""
        prompt = self.REFERENCE_EXTRACTION_PROMPT.format(reference_text=ref_text)

        try:
            response = self._call_llm(prompt, max_tokens=64000)
            result = self._parse_json_response(response)

            if isinstance(result, dict):
                references = result.get("references", [])
            elif isinstance(result, list):
                references = result
            else:
                references = []

            if not references:
                logger.warning(f"No references extracted from LLM response")
            else:
                logger.info(f"Extracted {len(references)} references")

            return references if isinstance(references, list) else []

        except Exception as e:
            logger.error(f"Failed to extract references with LLM: {e}")
            return []

    def _extract_references_chunked(self, ref_text: str) -> List[Dict]:
        """分块处理长参考文献文本"""
        all_references = []

        # 按引用编号分割
        # 常见格式：[1] xxx, 1. xxx, 或 1) xxx
        chunks = []
        current_chunk = ""
        lines = ref_text.split('\n')

        # 尝试按引用条目分割
        for line in lines:
            # 检测新条目开始：[数字] 或 数字. 或 数字)
            if re.match(r'^\s*\[\s*\d+\s*\]|^\s*\d+\s*\.|^\s*\d+\s*\)', line):
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = line
            else:
                current_chunk += "\n" + line

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        logger.info(f"Split references into {len(chunks)} potential entries")

        # 如果分割效果不好，回退到固定长度分割
        if len(chunks) < 3:
            logger.info("Pattern-based split ineffective, using fixed-size chunks")
            chunk_size = 15000
            chunks = [ref_text[i:i+chunk_size] for i in range(0, len(ref_text), chunk_size)]

        # 分批处理（每批约 30-50 条）
        batch_size = 50
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            batch_text = "\n\n".join(batch)

            logger.info(f"Processing batch {i//batch_size + 1}/{(len(chunks) + batch_size - 1)//batch_size}")

            refs = self._extract_references_single(batch_text)
            all_references.extend(refs)

            # 去重（基于标题）
            seen_titles = set()
            unique_refs = []
            for ref in all_references:
                title = ref.get('title', '').lower().strip() if ref.get('title') else ''
                if title and title not in seen_titles:
                    seen_titles.add(title)
                    unique_refs.append(ref)
                elif not title:
                    unique_refs.append(ref)  # 保留没有标题的条目

            all_references = unique_refs

        logger.info(f"Total extracted references: {len(all_references)}")
        return all_references

    def parse_all(self, file_path: str) -> Dict:
        """
        解析论文全部信息

        Args:
            file_path: PDF 文件路径

        Returns:
            包含元数据和参考文献的完整信息
        """
        metadata = self.parse_paper_metadata(file_path)
        references = self.extract_references(file_path)

        return {
            **metadata,
            "references": references
        }

    def extract_text(self) -> str:
        """提取 PDF 全部文本"""
        if self._doc is None:
            return ""
        return "\n\n".join([page.get_text() for page in self._doc])

    def extract_markdown(self) -> str:
        """提取 PDF 为 Markdown 格式"""
        if self._file_path is None:
            return ""
        return pymupdf4llm.to_markdown(self._file_path)

    def extract_page_texts(self) -> List[str]:
        """提取每页文本"""
        if self._doc is None:
            return []
        return [page.get_text() for page in self._doc]

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落切分文本"""
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

    def __del__(self):
        """关闭文档"""
        if self._doc:
            self._doc.close()
