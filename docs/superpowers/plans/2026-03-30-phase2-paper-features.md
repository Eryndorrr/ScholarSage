# 阶段2：论文专用功能 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强论文场景支持，实现论文元数据提取、引用解析、BibTeX生成和论文管理界面

**Architecture:** 在Phase 1基础上扩展，新增Paper/Citation模型、论文解析器、论文API和前端管理界面

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pdfplumber, React 18, TypeScript, Tailwind CSS

**Duration:** 1-2周（约10个工作日）

---

## 文件结构规划

### 后端新增文件
```
backend/
├── app/
│   ├── models/
│   │   ├── paper.py              # 论文模型
│   │   └── citation.py           # 引用模型
│   ├── schemas/
│   │   ├── paper.py              # 论文Pydantic模式
│   │   └── citation.py           # 引用Pydantic模式
│   ├── api/
│   │   └── papers.py             # 论文API
│   └── core/
│       └── parsers/
│           └── paper_parser.py   # 论文解析器
└── tests/
    ├── test_models/
    │   ├── test_paper.py
    │   └── test_citation.py
    ├── test_schemas/
    │   ├── test_paper_schema.py
    │   └── test_citation_schema.py
    ├── test_core/
    │   └── test_paper_parser.py
    └── test_api/
        └── test_papers.py
```

### 前端新增文件
```
frontend/src/
├── types/
│   ├── paper.ts                  # 论文类型定义
│   └── citation.ts               # 引用类型定义
├── services/
│   └── paperService.ts           # 论文API服务
├── hooks/
│   └── usePapers.ts              # 论文React Query hooks
└── components/
    └── PaperManager/
        ├── PaperList.tsx         # 论文列表
        ├── PaperCard.tsx         # 论文卡片
        ├── PaperDetail.tsx       # 论文详情
        ├── CitationList.tsx      # 引用列表
        └── BibTeXModal.tsx       # BibTeX导出弹窗
```

---

## Task 1: 论文数据模型

**Files:**
- Create: `backend/app/models/paper.py`
- Create: `backend/app/models/citation.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: 编写Paper模型测试**

Create: `backend/tests/test_models/test_paper.py`

```python
import pytest
from app.models.paper import Paper
from app.models.document import Document, FileType
from app.database import Base, engine
from sqlalchemy.orm import Session


def test_paper_model_creation():
    """测试论文模型创建"""
    paper = Paper(
        document_id="test-doc-id",
        title="Test Paper Title",
        authors=["Author One", "Author Two"],
        abstract="This is a test abstract.",
        keywords=["RAG", "LLM"],
        publication_year=2024,
        doi="10.1234/test.5678"
    )
    assert paper.title == "Test Paper Title"
    assert len(paper.authors) == 2
    assert paper.keywords == ["RAG", "LLM"]


def test_paper_model_defaults():
    """测试论文模型默认值"""
    paper = Paper(document_id="test-doc-id")
    assert paper.authors == []
    assert paper.keywords == []
    assert paper.publication_year is None
    assert paper.doi is None
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python -m pytest tests/test_models/test_paper.py -v`
Expected: FAIL with "module 'app.models.paper' has no attribute 'Paper'"

- [ ] **Step 3: 实现Paper模型**

Create: `backend/app/models/paper.py`

```python
from sqlalchemy import Column, String, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Paper(Base):
    """论文模型 - 存储论文专用元数据"""
    __tablename__ = "papers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), unique=True, nullable=False)
    title = Column(String(500), nullable=True)
    authors = Column(JSON, default=list)  # ["Author 1", "Author 2"]
    abstract = Column(Text, nullable=True)
    keywords = Column(JSON, default=list)  # ["keyword1", "keyword2"]
    publication_year = Column(Integer, nullable=True)
    doi = Column(String(100), nullable=True)
    venue = Column(String(200), nullable=True)  # 发表 venue (期刊/会议)

    # 关系
    document = relationship("Document", back_populates="paper")
    citations = relationship("Citation", back_populates="paper", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Paper {self.title}>"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python -m pytest tests/test_models/test_paper.py -v`
Expected: PASS

- [ ] **Step 5: 编写Citation模型测试**

Create: `backend/tests/test_models/test_citation.py`

```python
import pytest
from app.models.citation import Citation
from app.models.paper import Paper


def test_citation_model_creation():
    """测试引用模型创建"""
    citation = Citation(
        paper_id="test-paper-id",
        cited_title="Cited Paper Title",
        cited_authors=["Cited Author"],
        location="Page 5, Paragraph 2"
    )
    assert citation.cited_title == "Cited Paper Title"
    assert citation.cited_authors == ["Cited Author"]
    assert citation.location == "Page 5, Paragraph 2"


def test_citation_bibtex_generation():
    """测试BibTeX格式生成"""
    citation = Citation(
        paper_id="test-paper-id",
        cited_title="Test Paper",
        cited_authors=["John Doe", "Jane Smith"],
        cited_year=2023,
        cited_venue="NeurIPS"
    )
    bibtex = citation.to_bibtex()
    assert "@article" in bibtex or "@inproceedings" in bibtex
    assert "Test Paper" in bibtex
    assert "John Doe" in bibtex
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd backend && python -m pytest tests/test_models/test_citation.py -v`
Expected: FAIL with "module 'app.models.citation' has no attribute 'Citation'"

- [ ] **Step 7: 实现Citation模型**

Create: `backend/app/models/citation.py`

```python
from sqlalchemy import Column, String, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Citation(Base):
    """引用模型 - 存储论文引用关系"""
    __tablename__ = "citations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    paper_id = Column(String, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    cited_title = Column(String(500), nullable=True)
    cited_authors = Column(JSON, default=list)
    cited_year = Column(Integer, nullable=True)
    cited_venue = Column(String(200), nullable=True)
    location = Column(String(100), nullable=True)  # 引用位置 (e.g., "Page 5")
    bibtex_raw = Column(Text, nullable=True)  # 原始BibTeX

    # 关系
    paper = relationship("Paper", back_populates="citations")

    def __repr__(self):
        return f"<Citation: {self.cited_title}>"

    def to_bibtex(self) -> str:
        """生成BibTeX格式"""
        # 生成citation key
        first_author = self.cited_authors[0] if self.cited_authors else "Unknown"
        last_name = first_author.split()[-1] if first_author else "Unknown"
        year = self.cited_year or "n.d."
        cite_key = f"{last_name}{year}".replace(" ", "")

        # 确定类型
        entry_type = "inproceedings" if self.cited_venue else "article"

        # 生成BibTeX
        lines = [f"@{entry_type}{{{cite_key},"]
        lines.append(f"  title = {{{self.cited_title or 'Unknown'}}},")

        if self.cited_authors:
            authors = " and ".join(self.cited_authors)
            lines.append(f"  author = {{{authors}}},")

        if self.cited_year:
            lines.append(f"  year = {{{self.cited_year}}},")

        if self.cited_venue:
            lines.append(f"  booktitle/journal = {{{self.cited_venue}}},")

        lines.append("}")
        return "\n".join(lines)
```

- [ ] **Step 8: 运行测试确认通过**

Run: `cd backend && python -m pytest tests/test_models/test_citation.py -v`
Expected: PASS

- [ ] **Step 9: 更新模型导出和关系**

Modify: `backend/app/models/__init__.py`

```python
from app.models.collection import Collection
from app.models.document import Document, FileType
from app.models.chunk import Chunk
from app.models.paper import Paper
from app.models.citation import Citation

__all__ = ["Collection", "Document", "FileType", "Chunk", "Paper", "Citation"]
```

Modify: `backend/app/models/document.py` - 添加paper关系

```python
# 在 Document 类中添加
paper = relationship("Paper", back_populates="document", uselist=False)
```

- [ ] **Step 10: 提交模型更改**

```bash
git add backend/app/models/ backend/tests/test_models/
git commit -m "feat: add Paper and Citation models

- Add Paper model for paper metadata (title, authors, abstract, keywords)
- Add Citation model for reference tracking
- Add BibTeX generation in Citation model
- Add unit tests for both models"
```

---

## Task 2: Pydantic模式定义

**Files:**
- Create: `backend/app/schemas/paper.py`
- Create: `backend/app/schemas/citation.py`
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: 编写Paper Schema测试**

Create: `backend/tests/test_schemas/test_paper_schema.py`

```python
import pytest
from app.schemas.paper import PaperCreate, PaperResponse, PaperUpdate


def test_paper_create_schema():
    """测试论文创建模式"""
    paper = PaperCreate(
        document_id="test-doc-id",
        title="Test Paper",
        authors=["Author 1"],
        abstract="Abstract text",
        keywords=["test"]
    )
    assert paper.title == "Test Paper"
    assert paper.authors == ["Author 1"]


def test_paper_response_schema():
    """测试论文响应模式"""
    paper = PaperResponse(
        id="test-id",
        document_id="doc-id",
        title="Test Paper",
        authors=["Author"],
        abstract="Abstract",
        keywords=["kw"],
        publication_year=2024,
        doi="10.1234/test",
        venue="NeurIPS"
    )
    assert paper.id == "test-id"
    assert paper.venue == "NeurIPS"


def test_paper_update_schema():
    """测试论文更新模式"""
    update = PaperUpdate(
        title="Updated Title",
        keywords=["new", "keywords"]
    )
    assert update.title == "Updated Title"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python -m pytest tests/test_schemas/test_paper_schema.py -v`
Expected: FAIL

- [ ] **Step 3: 实现Paper Schema**

Create: `backend/app/schemas/paper.py`

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class PaperBase(BaseModel):
    """论文基础模型"""
    title: Optional[str] = Field(None, max_length=500)
    authors: List[str] = Field(default_factory=list)
    abstract: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    publication_year: Optional[int] = None
    doi: Optional[str] = Field(None, max_length=100)
    venue: Optional[str] = Field(None, max_length=200)


class PaperCreate(PaperBase):
    """创建论文请求"""
    document_id: str


class PaperUpdate(BaseModel):
    """更新论文请求"""
    title: Optional[str] = Field(None, max_length=500)
    authors: Optional[List[str]] = None
    abstract: Optional[str] = None
    keywords: Optional[List[str]] = None
    publication_year: Optional[int] = None
    doi: Optional[str] = Field(None, max_length=100)
    venue: Optional[str] = Field(None, max_length=200)


class PaperResponse(PaperBase):
    """论文响应"""
    id: str
    document_id: str

    class Config:
        from_attributes = True


class PaperListResponse(BaseModel):
    """论文列表响应"""
    papers: List[PaperResponse]
    total: int


class PaperWithCitationsResponse(PaperResponse):
    """带引用的论文详情响应"""
    citations_count: int = 0
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python -m pytest tests/test_schemas/test_paper_schema.py -v`
Expected: PASS

- [ ] **Step 5: 编写Citation Schema测试**

Create: `backend/tests/test_schemas/test_citation_schema.py`

```python
import pytest
from app.schemas.citation import CitationCreate, CitationResponse


def test_citation_create_schema():
    """测试引用创建模式"""
    citation = CitationCreate(
        paper_id="paper-id",
        cited_title="Cited Paper",
        cited_authors=["Author"],
        cited_year=2023
    )
    assert citation.cited_title == "Cited Paper"
    assert citation.cited_year == 2023


def test_citation_response_schema():
    """测试引用响应模式"""
    citation = CitationResponse(
        id="cite-id",
        paper_id="paper-id",
        cited_title="Title",
        cited_authors=["A1", "A2"],
        cited_year=2023,
        cited_venue="ICML",
        location="Page 5",
        bibtex_raw="@article{key, ...}"
    )
    assert citation.cited_authors == ["A1", "A2"]
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd backend && python -m pytest tests/test_schemas/test_citation_schema.py -v`
Expected: FAIL

- [ ] **Step 7: 实现Citation Schema**

Create: `backend/app/schemas/citation.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List


class CitationBase(BaseModel):
    """引用基础模型"""
    cited_title: Optional[str] = Field(None, max_length=500)
    cited_authors: List[str] = Field(default_factory=list)
    cited_year: Optional[int] = None
    cited_venue: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=100)


class CitationCreate(CitationBase):
    """创建引用请求"""
    paper_id: str
    bibtex_raw: Optional[str] = None


class CitationResponse(CitationBase):
    """引用响应"""
    id: str
    paper_id: str
    bibtex_raw: Optional[str] = None

    class Config:
        from_attributes = True


class CitationListResponse(BaseModel):
    """引用列表响应"""
    citations: List[CitationResponse]
    total: int


class BibTeXExportRequest(BaseModel):
    """BibTeX导出请求"""
    paper_ids: List[str]


class BibTeXExportResponse(BaseModel):
    """BibTeX导出响应"""
    bibtex_entries: List[str]
```

- [ ] **Step 8: 运行测试确认通过**

Run: `cd backend && python -m pytest tests/test_schemas/test_citation_schema.py -v`
Expected: PASS

- [ ] **Step 9: 更新Schema导出**

Modify: `backend/app/schemas/__init__.py`

```python
from app.schemas.collection import CollectionCreate, CollectionResponse, CollectionListResponse
from app.schemas.document import DocumentCreate, DocumentResponse, SourceResponse
from app.schemas.query import QueryRequest, QueryResponse
from app.schemas.paper import (
    PaperCreate, PaperUpdate, PaperResponse,
    PaperListResponse, PaperWithCitationsResponse
)
from app.schemas.citation import (
    CitationCreate, CitationResponse,
    CitationListResponse, BibTeXExportRequest, BibTeXExportResponse
)

__all__ = [
    "CollectionCreate", "CollectionResponse", "CollectionListResponse",
    "DocumentCreate", "DocumentResponse", "SourceResponse",
    "QueryRequest", "QueryResponse",
    "PaperCreate", "PaperUpdate", "PaperResponse", "PaperListResponse", "PaperWithCitationsResponse",
    "CitationCreate", "CitationResponse", "CitationListResponse",
    "BibTeXExportRequest", "BibTeXExportResponse"
]
```

- [ ] **Step 10: 提交Schema更改**

```bash
git add backend/app/schemas/ backend/tests/test_schemas/
git commit -m "feat: add Paper and Citation Pydantic schemas

- Add PaperCreate, PaperUpdate, PaperResponse schemas
- Add CitationCreate, CitationResponse schemas
- Add BibTeX export request/response schemas"
```

---

## Task 3: 论文解析器

**Files:**
- Create: `backend/app/core/parsers/paper_parser.py`
- Create: `backend/tests/test_core/test_paper_parser.py`

- [ ] **Step 1: 编写论文解析器测试**

Create: `backend/tests/test_core/test_paper_parser.py`

```python
import pytest
from app.core.parsers.paper_parser import PaperParser


def test_extract_title():
    """测试标题提取"""
    # 这个测试需要一个实际的PDF文件或模拟
    parser = PaperParser("dummy_path.pdf")
    # 使用模拟文本测试
    text = "This is a sample paper title\n\nAuthor Name\n\nAbstract"
    title = parser._extract_title_from_text(text)
    assert title is not None


def test_extract_authors():
    """测试作者提取"""
    parser = PaperParser("dummy_path.pdf")
    text = "Title\n\nJohn Doe, Jane Smith, Bob Johnson\n\nAbstract"
    authors = parser._extract_authors_from_text(text)
    assert len(authors) >= 1


def test_extract_abstract():
    """测试摘要提取"""
    parser = PaperParser("dummy_path.pdf")
    text = "Title\n\nAbstract\nThis is the abstract content.\n\n1 Introduction"
    abstract = parser._extract_abstract_from_text(text)
    assert "abstract content" in abstract.lower()


def test_extract_keywords():
    """测试关键词提取"""
    parser = PaperParser("dummy_path.pdf")
    text = "Keywords: RAG, LLM, retrieval, generation\n\n1 Introduction"
    keywords = parser._extract_keywords_from_text(text)
    assert "RAG" in keywords
    assert "LLM" in keywords


def test_generate_bibtex():
    """测试BibTeX生成"""
    parser = PaperParser("dummy_path.pdf")
    bibtex = parser.generate_bibtex(
        title="Test Paper",
        authors=["John Doe"],
        year=2024,
        venue="NeurIPS"
    )
    assert "@inproceedings" in bibtex
    assert "Test Paper" in bibtex
    assert "John Doe" in bibtex
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python -m pytest tests/test_core/test_paper_parser.py -v`
Expected: FAIL

- [ ] **Step 3: 实现论文解析器**

Create: `backend/app/core/parsers/paper_parser.py`

```python
import re
from typing import List, Dict, Optional, Tuple
from pypdf import PdfReader
from app.core.parsers.base_parser import BaseParser


class PaperParser(BaseParser):
    """学术论文解析器 - 提取元数据和引用"""

    # 常见标题关键词（用于识别标题）
    TITLE_INDICATORS = [
        r"^[A-Z][^.!?]*[A-Z][^.!?]*$",  # 至少两个大写词
    ]

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
        self._text_cache: Optional[str] = None
        self._pages: List[str] = []

    def _load_pdf(self) -> PdfReader:
        """加载PDF文件"""
        try:
            return PdfReader(self.file_path)
        except FileNotFoundError:
            raise FileNotFoundError(f"PDF文件不存在: {self.file_path}")

    def extract_text(self) -> str:
        """提取PDF全部文本"""
        if self._text_cache is not None:
            return self._text_cache

        reader = self._load_pdf()
        self._pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            self._pages.append(text)

        self._text_cache = "\n\n".join(self._pages)
        return self._text_cache

    def extract_page_texts(self) -> List[str]:
        """提取每页文本"""
        if not self._pages:
            self.extract_text()
        return self._pages

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落和大小切分文本"""
        text = self.extract_text()
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                current_chunk = overlap_text + " " + para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

        if current_chunk:
            chunks.append(current_chunk.strip())

        return [c for c in chunks if c and len(c) > 10]

    def parse_paper_metadata(self) -> Dict:
        """解析论文元数据"""
        text = self.extract_text()
        pages = self.extract_page_texts()

        # 通常标题和作者在第一页
        first_page = pages[0] if pages else text

        return {
            "title": self._extract_title(first_page),
            "authors": self._extract_authors(first_page),
            "abstract": self._extract_abstract(text),
            "keywords": self._extract_keywords(text),
            "publication_year": self._extract_year(text),
        }

    def _extract_title(self, text: str) -> Optional[str]:
        """从文本中提取标题"""
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

    def _extract_title_from_text(self, text: str) -> Optional[str]:
        """公开方法：从文本提取标题"""
        return self._extract_title(text)

    def _extract_authors(self, text: str) -> List[str]:
        """从文本中提取作者列表"""
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

    def _extract_authors_from_text(self, text: str) -> List[str]:
        """公开方法：从文本提取作者"""
        return self._extract_authors(text)

    def _extract_abstract(self, text: str) -> Optional[str]:
        """从文本中提取摘要"""
        for start_pattern, end_pattern in self.ABSTRACT_MARKERS:
            match = re.search(
                start_pattern + r"(.*?)" + end_pattern,
                text,
                re.DOTALL | re.IGNORECASE
            )
            if match:
                abstract = match.group(1).strip()
                # 清理摘要
                abstract = re.sub(r'\s+', ' ', abstract)
                if len(abstract) > 50:  # 至少50字符
                    return abstract

        return None

    def _extract_abstract_from_text(self, text: str) -> Optional[str]:
        """公开方法：从文本提取摘要"""
        return self._extract_abstract(text)

    def _extract_keywords(self, text: str) -> List[str]:
        """从文本中提取关键词"""
        for pattern in self.KEYWORD_MARKERS:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                keywords_str = match.group(1).strip()
                # 分割关键词
                keywords = re.split(r'[,;·]\s*', keywords_str)
                # 清理
                keywords = [k.strip() for k in keywords if k.strip() and len(k.strip()) > 1]
                return keywords[:10]  # 最多10个关键词

        return []

    def _extract_keywords_from_text(self, text: str) -> List[str]:
        """公开方法：从文本提取关键词"""
        return self._extract_keywords(text)

    def _extract_year(self, text: str) -> Optional[int]:
        """从文本中提取发表年份"""
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python -m pytest tests/test_core/test_paper_parser.py -v`
Expected: PASS

- [ ] **Step 5: 提交论文解析器**

```bash
git add backend/app/core/parsers/paper_parser.py backend/tests/test_core/test_paper_parser.py
git commit -m "feat: add PaperParser for academic paper metadata extraction

- Extract title, authors, abstract, keywords from PDF
- Parse references section
- Generate BibTeX entries
- Support multiple reference formats"
```

---

## Task 4: 论文API实现

**Files:**
- Create: `backend/app/api/papers.py`
- Create: `backend/tests/test_api/test_papers.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 编写论文API测试**

Create: `backend/tests/test_api/test_papers.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestPapersAPI:
    """论文API测试"""

    def test_parse_paper_endpoint(self):
        """测试论文解析端点"""
        # 先创建一个collection和document
        collection_resp = client.post("/api/collections", json={
            "name": "Test Collection",
            "description": "Test"
        })
        collection_id = collection_resp.json()["id"]

        # 测试解析API（需要实际PDF文件）
        # 这里主要测试API结构
        pass

    def test_get_paper_by_document(self):
        """测试通过文档ID获取论文"""
        response = client.get("/api/papers/by-document/nonexistent")
        assert response.status_code == 404

    def test_update_paper_metadata(self):
        """测试更新论文元数据"""
        response = client.put("/api/papers/nonexistent", json={
            "title": "Updated Title"
        })
        assert response.status_code == 404

    def test_get_paper_citations(self):
        """测试获取论文引用列表"""
        response = client.get("/api/papers/nonexistent/citations")
        assert response.status_code == 404

    def test_generate_bibtex(self):
        """测试生成BibTeX"""
        response = client.post("/api/papers/generate-bibtex", json={
            "paper_ids": ["nonexistent"]
        })
        # 即使论文不存在，也应该返回空结果而不是错误
        assert response.status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && python -m pytest tests/test_api/test_papers.py -v`
Expected: FAIL with 404 errors

- [ ] **Step 3: 实现论文API**

Create: `backend/app/api/papers.py`

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Document, Paper, Citation, Collection
from app.schemas import (
    PaperCreate, PaperUpdate, PaperResponse,
    PaperListResponse, PaperWithCitationsResponse,
    CitationCreate, CitationResponse, CitationListResponse,
    BibTeXExportRequest, BibTeXExportResponse
)
from app.core.parsers.paper_parser import PaperParser
import os
import tempfile

router = APIRouter(prefix="/api/papers", tags=["papers"])


@router.post("/parse", response_model=PaperResponse)
async def parse_paper(
    document_id: str,
    db: Session = Depends(get_db)
):
    """解析文档中的论文元数据"""
    # 查找文档
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # 检查是否已解析
    existing_paper = db.query(Paper).filter(Paper.document_id == document_id).first()
    if existing_paper:
        return existing_paper

    # 解析PDF
    if document.file_type != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported for paper parsing")

    try:
        parser = PaperParser(document.file_path)
        metadata = parser.parse_paper_metadata()
        references = parser.extract_references()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse paper: {str(e)}")

    # 创建论文记录
    paper = Paper(
        document_id=document_id,
        title=metadata.get("title") or document.title,
        authors=metadata.get("authors", []),
        abstract=metadata.get("abstract"),
        keywords=metadata.get("keywords", []),
        publication_year=metadata.get("publication_year"),
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    # 创建引用记录
    for ref in references:
        citation = Citation(
            paper_id=paper.id,
            cited_title=ref.get("title"),
            cited_authors=ref.get("authors", []),
            cited_year=ref.get("year"),
            cited_venue=ref.get("venue"),
        )
        db.add(citation)

    db.commit()

    return paper


@router.get("/by-document/{document_id}", response_model=PaperResponse)
def get_paper_by_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """通过文档ID获取论文信息"""
    paper = db.query(Paper).filter(Paper.document_id == document_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@router.get("/{paper_id}", response_model=PaperWithCitationsResponse)
def get_paper(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """获取论文详情（含引用数量）"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    citations_count = db.query(Citation).filter(Citation.paper_id == paper_id).count()

    return PaperWithCitationsResponse(
        **{c.name: getattr(paper, c.name) for c in paper.__table__.columns},
        citations_count=citations_count
    )


@router.put("/{paper_id}", response_model=PaperResponse)
def update_paper(
    paper_id: str,
    paper_update: PaperUpdate,
    db: Session = Depends(get_db)
):
    """更新论文元数据"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    update_data = paper_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(paper, key, value)

    db.commit()
    db.refresh(paper)
    return paper


@router.get("/{paper_id}/citations", response_model=CitationListResponse)
def get_paper_citations(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """获取论文的引用列表"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    citations = db.query(Citation).filter(Citation.paper_id == paper_id).all()
    return CitationListResponse(citations=citations, total=len(citations))


@router.post("/generate-bibtex", response_model=BibTeXExportResponse)
def generate_bibtex(
    request: BibTeXExportRequest,
    db: Session = Depends(get_db)
):
    """生成选定论文的BibTeX"""
    bibtex_entries = []

    for paper_id in request.paper_ids:
        paper = db.query(Paper).filter(Paper.id == paper_id).first()
        if paper and paper.title:
            parser = PaperParser.__new__(PaperParser)
            bibtex = parser.generate_bibtex(
                title=paper.title,
                authors=paper.authors or [],
                year=paper.publication_year,
                venue=paper.venue,
                doi=paper.doi
            )
            bibtex_entries.append(bibtex)

    return BibTeXExportResponse(bibtex_entries=bibtex_entries)


@router.get("/collection/{collection_id}", response_model=PaperListResponse)
def list_papers_by_collection(
    collection_id: str,
    db: Session = Depends(get_db)
):
    """获取知识库中的所有论文"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # 查询该知识库下所有文档的论文
    papers = (
        db.query(Paper)
        .join(Document)
        .filter(Document.collection_id == collection_id)
        .all()
    )

    return PaperListResponse(papers=papers, total=len(papers))


@router.delete("/{paper_id}")
def delete_paper(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """删除论文（同时删除关联的引用）"""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    db.delete(paper)
    db.commit()
    return {"success": True, "message": "Paper deleted"}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && python -m pytest tests/test_api/test_papers.py -v`
Expected: PASS

- [ ] **Step 5: 注册路由到主应用**

Modify: `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api import collections, documents, query, papers

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    description="企业级RAG知识库系统",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(collections.router)
app.include_router(documents.router)
app.include_router(query.router)
app.include_router(papers.router)


@app.get("/")
def root():
    """根路径"""
    return {
        "message": "RAG Knowledge Base API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy"}
```

- [ ] **Step 6: 提交论文API**

```bash
git add backend/app/api/papers.py backend/tests/test_api/test_papers.py backend/app/main.py
git commit -m "feat: add Papers API for paper metadata management

- Add endpoints: parse, get, update, delete papers
- Add citations listing and BibTeX generation
- Add collection-based paper listing"
```

---

## Task 5: 前端类型定义

**Files:**
- Create: `frontend/src/types/paper.ts`
- Create: `frontend/src/types/citation.ts`

- [ ] **Step 1: 创建Paper类型定义**

Create: `frontend/src/types/paper.ts`

```typescript
export interface Paper {
  id: string
  document_id: string
  title: string | null
  authors: string[]
  abstract: string | null
  keywords: string[]
  publication_year: number | null
  doi: string | null
  venue: string | null
}

export interface PaperWithCitations extends Paper {
  citations_count: number
}

export interface PaperListResponse {
  papers: Paper[]
  total: number
}

export interface PaperCreate {
  document_id: string
  title?: string
  authors?: string[]
  abstract?: string
  keywords?: string[]
  publication_year?: number
  doi?: string
  venue?: string
}

export interface PaperUpdate {
  title?: string
  authors?: string[]
  abstract?: string
  keywords?: string[]
  publication_year?: number
  doi?: string
  venue?: string
}
```

- [ ] **Step 2: 创建Citation类型定义**

Create: `frontend/src/types/citation.ts`

```typescript
export interface Citation {
  id: string
  paper_id: string
  cited_title: string | null
  cited_authors: string[]
  cited_year: number | null
  cited_venue: string | null
  location: string | null
  bibtex_raw: string | null
}

export interface CitationListResponse {
  citations: Citation[]
  total: number
}

export interface BibTeXExportRequest {
  paper_ids: string[]
}

export interface BibTeXExportResponse {
  bibtex_entries: string[]
}
```

- [ ] **Step 3: 提交类型定义**

```bash
git add frontend/src/types/paper.ts frontend/src/types/citation.ts
git commit -m "feat: add TypeScript types for Paper and Citation"
```

---

## Task 6: 前端API服务

**Files:**
- Create: `frontend/src/services/paperService.ts`

- [ ] **Step 1: 创建论文API服务**

Create: `frontend/src/services/paperService.ts`

```typescript
import api from './api'
import type {
  Paper,
  PaperWithCitations,
  PaperListResponse,
  PaperUpdate,
} from '../types/paper'
import type {
  CitationListResponse,
  BibTeXExportRequest,
  BibTeXExportResponse,
} from '../types/citation'

const BASE_URL = '/api/papers'

export const paperService = {
  // 解析论文元数据
  async parsePaper(documentId: string): Promise<Paper> {
    const response = await api.post<Paper>(`${BASE_URL}/parse?document_id=${documentId}`)
    return response.data
  },

  // 通过文档ID获取论文
  async getPaperByDocument(documentId: string): Promise<Paper> {
    const response = await api.get<Paper>(`${BASE_URL}/by-document/${documentId}`)
    return response.data
  },

  // 获取论文详情
  async getPaper(paperId: string): Promise<PaperWithCitations> {
    const response = await api.get<PaperWithCitations>(`${BASE_URL}/${paperId}`)
    return response.data
  },

  // 更新论文元数据
  async updatePaper(paperId: string, data: PaperUpdate): Promise<Paper> {
    const response = await api.put<Paper>(`${BASE_URL}/${paperId}`, data)
    return response.data
  },

  // 获取论文引用列表
  async getCitations(paperId: string): Promise<CitationListResponse> {
    const response = await api.get<CitationListResponse>(`${BASE_URL}/${paperId}/citations`)
    return response.data
  },

  // 生成BibTeX
  async generateBibTeX(paperIds: string[]): Promise<BibTeXExportResponse> {
    const response = await api.post<BibTeXExportResponse>(`${BASE_URL}/generate-bibtex`, {
      paper_ids: paperIds,
    } as BibTeXExportRequest)
    return response.data
  },

  // 获取知识库的论文列表
  async listPapersByCollection(collectionId: string): Promise<PaperListResponse> {
    const response = await api.get<PaperListResponse>(`${BASE_URL}/collection/${collectionId}`)
    return response.data
  },

  // 删除论文
  async deletePaper(paperId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${paperId}`)
  },
}
```

- [ ] **Step 2: 提交API服务**

```bash
git add frontend/src/services/paperService.ts
git commit -m "feat: add paperService for Paper API calls"
```

---

## Task 7: React Query Hooks

**Files:**
- Create: `frontend/src/hooks/usePapers.ts`

- [ ] **Step 1: 创建论文相关Hooks**

Create: `frontend/src/hooks/usePapers.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paperService } from '../services/paperService'
import type { PaperUpdate } from '../types/paper'

// 获取知识库论文列表
export function usePapers(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['papers', 'collection', collectionId],
    queryFn: () => paperService.listPapersByCollection(collectionId!),
    enabled: !!collectionId,
  })
}

// 获取论文详情
export function usePaper(paperId: string | undefined) {
  return useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => paperService.getPaper(paperId!),
    enabled: !!paperId,
  })
}

// 获取论文引用
export function useCitations(paperId: string | undefined) {
  return useQuery({
    queryKey: ['citations', paperId],
    queryFn: () => paperService.getCitations(paperId!),
    enabled: !!paperId,
  })
}

// 解析论文元数据
export function useParsePaper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) => paperService.parsePaper(documentId),
    onSuccess: (_, documentId) => {
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['papers'] })
      queryClient.invalidateQueries({ queryKey: ['paper'] })
    },
  })
}

// 更新论文
export function useUpdatePaper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ paperId, data }: { paperId: string; data: PaperUpdate }) =>
      paperService.updatePaper(paperId, data),
    onSuccess: (_, { paperId }) => {
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] })
      queryClient.invalidateQueries({ queryKey: ['papers'] })
    },
  })
}

// 生成BibTeX
export function useGenerateBibTeX() {
  return useMutation({
    mutationFn: (paperIds: string[]) => paperService.generateBibTeX(paperIds),
  })
}

// 删除论文
export function useDeletePaper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paperId: string) => paperService.deletePaper(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papers'] })
    },
  })
}
```

- [ ] **Step 2: 提交Hooks**

```bash
git add frontend/src/hooks/usePapers.ts
git commit -m "feat: add React Query hooks for Paper operations"
```

---

## Task 8: 论文卡片组件

**Files:**
- Create: `frontend/src/components/PaperManager/PaperCard.tsx`

- [ ] **Step 1: 创建PaperCard组件**

Create: `frontend/src/components/PaperManager/PaperCard.tsx`

```tsx
import type { Paper } from '../../types/paper'

interface PaperCardProps {
  paper: Paper
  selected?: boolean
  onSelect?: () => void
  onClick?: () => void
}

export function PaperCard({ paper, selected, onSelect, onClick }: PaperCardProps) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* 选择框 */}
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h3 className="font-medium text-gray-900 truncate" title={paper.title || '未命名论文'}>
            {paper.title || '未命名论文'}
          </h3>

          {/* 作者 */}
          {paper.authors.length > 0 && (
            <p className="text-sm text-gray-600 mt-1 truncate">
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ` 等${paper.authors.length}人`}
            </p>
          )}

          {/* 元信息 */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {paper.publication_year && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {paper.publication_year}
              </span>
            )}
            {paper.venue && (
              <span className="truncate max-w-[150px]" title={paper.venue}>
                {paper.venue}
              </span>
            )}
          </div>

          {/* 关键词 */}
          {paper.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {paper.keywords.slice(0, 3).map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                >
                  {keyword}
                </span>
              ))}
              {paper.keywords.length > 3 && (
                <span className="text-xs text-gray-400">+{paper.keywords.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交PaperCard组件**

```bash
git add frontend/src/components/PaperManager/PaperCard.tsx
git commit -m "feat: add PaperCard component for displaying paper info"
```

---

## Task 9: 论文列表组件

**Files:**
- Create: `frontend/src/components/PaperManager/PaperList.tsx`

- [ ] **Step 1: 创建PaperList组件**

Create: `frontend/src/components/PaperManager/PaperList.tsx`

```tsx
import { useState } from 'react'
import { usePapers, useParsePaper, useDeletePaper, useGenerateBibTeX } from '../../hooks/usePapers'
import { PaperCard } from './PaperCard'
import { BibTeXModal } from './BibTeXModal'

interface PaperListProps {
  collectionId: string | undefined
  onSelectPaper?: (paperId: string) => void
}

export function PaperList({ collectionId, onSelectPaper }: PaperListProps) {
  const { data, isLoading, error } = usePapers(collectionId)
  const parseMutation = useParsePaper()
  const deleteMutation = useDeletePaper()
  const bibtexMutation = useGenerateBibTeX()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBibTeX, setShowBibTeX] = useState(false)
  const [bibtexContent, setBibtexContent] = useState<string[]>([])

  const toggleSelect = (paperId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(paperId)) {
      newSelected.delete(paperId)
    } else {
      newSelected.add(paperId)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (data?.papers) {
      if (selectedIds.size === data.papers.length) {
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set(data.papers.map((p) => p.id)))
      }
    }
  }

  const handleExportBibTeX = async () => {
    if (selectedIds.size === 0) return

    const result = await bibtexMutation.mutateAsync(Array.from(selectedIds))
    setBibtexContent(result.bibtex_entries)
    setShowBibTeX(true)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    if (!confirm(`确定要删除 ${selectedIds.size} 篇论文吗？`)) return

    for (const id of selectedIds) {
      await deleteMutation.mutateAsync(id)
    }
    setSelectedIds(new Set())
  }

  if (!collectionId) {
    return (
      <div className="text-center text-gray-500 py-8">
        请先选择一个知识库
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        加载失败: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data?.papers?.length > 0 && selectedIds.size === data?.papers?.length}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">全选</span>
          </label>
          <span className="text-sm text-gray-500">
            已选择 {selectedIds.size} 篇
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBibTeX}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            导出BibTeX
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            删除
          </button>
        </div>
      </div>

      {/* 论文列表 */}
      {data?.papers?.length === 0 ? (
        <div className="text-center text-gray-500 py-8 bg-white rounded-lg shadow">
          暂无论文，上传PDF文档后将自动解析论文元数据
        </div>
      ) : (
        <div className="space-y-3">
          {data?.papers?.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              selected={selectedIds.has(paper.id)}
              onSelect={() => toggleSelect(paper.id)}
              onClick={() => onSelectPaper?.(paper.id)}
            />
          ))}
        </div>
      )}

      {/* BibTeX弹窗 */}
      {showBibTeX && (
        <BibTeXModal
          entries={bibtexContent}
          onClose={() => setShowBibTeX(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 提交PaperList组件**

```bash
git add frontend/src/components/PaperManager/PaperList.tsx
git commit -m "feat: add PaperList component with selection and export"
```

---

## Task 10: BibTeX导出弹窗

**Files:**
- Create: `frontend/src/components/PaperManager/BibTeXModal.tsx`

- [ ] **Step 1: 创建BibTeXModal组件**

Create: `frontend/src/components/PaperManager/BibTeXModal.tsx`

```tsx
import { useState } from 'react'

interface BibTeXModalProps {
  entries: string[]
  onClose: () => void
}

export function BibTeXModal({ entries, onClose }: BibTeXModalProps) {
  const [copied, setCopied] = useState(false)

  const bibtexText = entries.join('\n\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bibtexText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([bibtexText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'references.bib'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">BibTeX 引用</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {entries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              没有可导出的BibTeX条目
            </p>
          ) : (
            <pre className="bg-gray-50 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap break-all">
              {bibtexText}
            </pre>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已复制
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                复制
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载 .bib
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交BibTeXModal组件**

```bash
git add frontend/src/components/PaperManager/BibTeXModal.tsx
git commit -m "feat: add BibTeXModal for exporting BibTeX citations"
```

---

## Task 11: 论文详情组件

**Files:**
- Create: `frontend/src/components/PaperManager/PaperDetail.tsx`
- Create: `frontend/src/components/PaperManager/CitationList.tsx`

- [ ] **Step 1: 创建CitationList组件**

Create: `frontend/src/components/PaperManager/CitationList.tsx`

```tsx
import { useCitations } from '../../hooks/usePapers'

interface CitationListProps {
  paperId: string
}

export function CitationList({ paperId }: CitationListProps) {
  const { data, isLoading, error } = useCitations(paperId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-4">
        加载失败: {error.message}
      </div>
    )
  }

  if (!data?.citations?.length) {
    return (
      <div className="text-center text-gray-500 py-4">
        暂无引用信息
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700">
        参考文献 ({data.total})
      </h4>
      <ul className="space-y-2">
        {data.citations.map((citation) => (
          <li
            key={citation.id}
            className="p-3 bg-gray-50 rounded-lg text-sm"
          >
            <p className="font-medium text-gray-900">
              {citation.cited_title || '未知标题'}
            </p>
            {citation.cited_authors.length > 0 && (
              <p className="text-gray-600 mt-1">
                {citation.cited_authors.join(', ')}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {citation.cited_year && <span>{citation.cited_year}</span>}
              {citation.cited_venue && <span>· {citation.cited_venue}</span>}
              {citation.location && <span>· {citation.location}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: 创建PaperDetail组件**

Create: `frontend/src/components/PaperManager/PaperDetail.tsx`

```tsx
import { usePaper } from '../../hooks/usePapers'
import { CitationList } from './CitationList'

interface PaperDetailProps {
  paperId: string
  onClose?: () => void
}

export function PaperDetail({ paperId, onClose }: PaperDetailProps) {
  const { data: paper, isLoading, error } = usePaper(paperId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="text-center text-red-500 py-8">
        加载失败: {error?.message || '论文不存在'}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 头部 */}
      <div className="flex items-start justify-between p-4 border-b">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {paper.title || '未命名论文'}
          </h2>
          {paper.authors.length > 0 && (
            <p className="text-gray-600 mt-1">
              {paper.authors.join(', ')}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 元信息 */}
      <div className="p-4 border-b">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {paper.publication_year && (
            <div>
              <span className="text-gray-500">发表年份:</span>
              <span className="ml-2 text-gray-900">{paper.publication_year}</span>
            </div>
          )}
          {paper.venue && (
            <div>
              <span className="text-gray-500">发表 venue:</span>
              <span className="ml-2 text-gray-900">{paper.venue}</span>
            </div>
          )}
          {paper.doi && (
            <div className="col-span-2">
              <span className="text-gray-500">DOI:</span>
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-600 hover:underline"
              >
                {paper.doi}
              </a>
            </div>
          )}
          <div>
            <span className="text-gray-500">引用数:</span>
            <span className="ml-2 text-gray-900">{paper.citations_count}</span>
          </div>
        </div>

        {/* 关键词 */}
        {paper.keywords.length > 0 && (
          <div className="mt-4">
            <span className="text-gray-500 text-sm">关键词:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {paper.keywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 摘要 */}
      {paper.abstract && (
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-700 mb-2">摘要</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {paper.abstract}
          </p>
        </div>
      )}

      {/* 引用列表 */}
      <div className="p-4">
        <CitationList paperId={paperId} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 提交详情组件**

```bash
git add frontend/src/components/PaperManager/PaperDetail.tsx frontend/src/components/PaperManager/CitationList.tsx
git commit -m "feat: add PaperDetail and CitationList components"
```

---

## Task 12: 集成论文管理到主应用

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout/Header.tsx`

- [ ] **Step 1: 更新Header添加论文导航**

Read: `frontend/src/components/Layout/Header.tsx`

- [ ] **Step 2: 修改Header组件**

Modify: `frontend/src/components/Layout/Header.tsx`

```tsx
interface HeaderProps {
  activeTab: 'collections' | 'papers' | 'qa'
  onTabChange: (tab: 'collections' | 'papers' | 'qa') => void
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            RAG知识库系统
          </h1>

          <nav className="flex gap-4">
            <button
              onClick={() => onTabChange('collections')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'collections'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              知识库
            </button>
            <button
              onClick={() => onTabChange('papers')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'papers'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              论文管理
            </button>
            <button
              onClick={() => onTabChange('qa')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'qa'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              智能问答
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: 修改App.tsx集成论文管理**

Modify: `frontend/src/App.tsx`

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MainLayout } from './components/Layout/MainLayout'
import { Header } from './components/Layout/Header'
import { CollectionList } from './components/CollectionManager/CollectionList'
import { ChatWindow } from './components/QAInterface/ChatWindow'
import { PaperList } from './components/PaperManager/PaperList'
import { PaperDetail } from './components/PaperManager/PaperDetail'

const queryClient = new QueryClient()

function App() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'collections' | 'papers' | 'qa'>('collections')

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
        <MainLayout>
          {activeTab === 'collections' && (
            <div className="flex gap-6">
              <div className="w-80 flex-shrink-0">
                <CollectionList onSelectCollection={setSelectedCollection} />
              </div>
              <div className="flex-1">
                <ChatWindow collectionId={selectedCollection} />
              </div>
            </div>
          )}

          {activeTab === 'papers' && (
            <div className="flex gap-6">
              <div className="flex-1">
                <PaperList
                  collectionId={selectedCollection || undefined}
                  onSelectPaper={setSelectedPaper}
                />
              </div>
              {selectedPaper && (
                <div className="w-96 flex-shrink-0">
                  <PaperDetail
                    paperId={selectedPaper}
                    onClose={() => setSelectedPaper(null)}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="max-w-4xl mx-auto">
              <ChatWindow collectionId={selectedCollection} />
            </div>
          )}
        </MainLayout>
      </div>
    </QueryClientProvider>
  )
}

export default App
```

- [ ] **Step 4: 提交集成更改**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout/Header.tsx
git commit -m "feat: integrate Paper management into main application

- Add Papers tab to navigation
- Add paper detail panel view
- Support switching between Collections, Papers, and QA tabs"
```

---

## Task 13: 数据库迁移和测试

**Files:**
- Modify: `backend/requirements.txt` (如需添加新依赖)

- [ ] **Step 1: 检查依赖**

检查 `backend/requirements.txt` 确保包含所需依赖：
- `pypdf` (已有，用于PDF解析)
- `sqlalchemy` (已有)
- `pydantic` (已有)

- [ ] **Step 2: 运行所有测试**

Run: `cd backend && python -m pytest tests/ -v`

Expected: All tests pass

- [ ] **Step 3: 重建数据库**

删除现有数据库并重新初始化：
```bash
cd backend
rm -f data/knowledge.db
rm -rf data/chroma
python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"
```

- [ ] **Step 4: 启动后端测试**

Run: `cd backend && uvicorn app.main:app --reload`

测试API端点：
- GET `/api/papers/collection/{collection_id}` - 获取论文列表
- POST `/api/papers/parse?document_id={id}` - 解析论文

- [ ] **Step 5: 启动前端测试**

Run: `cd frontend && npm run dev`

测试前端功能：
- 论文列表显示
- 论文详情查看
- BibTeX导出

- [ ] **Step 6: 最终提交**

```bash
git add .
git commit -m "feat: complete Phase 2 - Paper-specific features

- Add Paper and Citation models
- Add paper metadata extraction from PDF
- Add BibTeX generation
- Add paper management UI
- Add citation list and export functionality"
```

---

## 验收标准

### 功能验收
- [ ] 可以上传PDF并自动解析论文元数据
- [ ] 可以查看论文标题、作者、摘要、关键词
- [ ] 可以查看论文的参考文献列表
- [ ] 可以生成并导出BibTeX引用
- [ ] 可以按知识库管理论文
- [ ] 可以编辑论文元数据

### 技术验收
- [ ] 所有测试通过
- [ ] API文档完整
- [ ] 前端类型安全
- [ ] 响应式UI设计

---

## 下一步（Phase 3）

Phase 2 完成后，可以继续进行 Phase 3：效果评估体系
- RAGAS评估框架集成
- 性能指标监控
- 评估报告生成
- 参数对比工具
