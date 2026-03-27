# 阶段1：核心RAG功能 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建基础RAG问答系统，支持文档上传、向量化、智能问答和来源追溯

**Architecture:** 三层架构（React前端 + FastAPI后端 + Chroma向量库），TDD开发模式，渐进式实现核心功能

**Tech Stack:** FastAPI, LlamaIndex, Chroma, OpenAI API, React 18, TypeScript, Tailwind CSS, SQLite

**Duration:** 2-3周（约15-20个工作日）

---

## 文件结构规划

### 后端文件结构
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI应用入口
│   ├── config.py                        # 配置管理
│   ├── database.py                      # 数据库连接
│   ├── models/                          # SQLAlchemy模型
│   │   ├── __init__.py
│   │   ├── collection.py                # 知识库模型
│   │   ├── document.py                  # 文档模型
│   │   └── chunk.py                     # 文档切片模型
│   ├── schemas/                         # Pydantic模式
│   │   ├── __init__.py
│   │   ├── collection.py
│   │   ├── document.py
│   │   └── query.py
│   ├── api/                             # API路由
│   │   ├── __init__.py
│   │   ├── collections.py               # 知识库管理API
│   │   ├── documents.py                 # 文档管理API
│   │   └── query.py                     # 问答API
│   ├── core/                            # 核心功能
│   │   ├── __init__.py
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   ├── document_processor.py    # 文档处理
│   │   │   ├── embeddings.py            # 向量化
│   │   │   ├── retriever.py             # 检索器
│   │   │   └── generator.py             # 生成器
│   │   └── parsers/
│   │       ├── __init__.py
│   │       ├── pdf_parser.py            # PDF解析
│   │       └── markdown_parser.py       # Markdown解析
│   └── utils/
│       ├── __init__.py
│       └── file_utils.py                # 文件工具
├── tests/                               # 测试
│   ├── __init__.py
│   ├── conftest.py                      # Pytest配置
│   ├── test_models/
│   ├── test_api/
│   └── test_core/
├── requirements.txt                     # 依赖
└── .env.example                         # 环境变量模板
```

### 前端文件结构
```
frontend/
├── src/
│   ├── App.tsx                          # 主应用
│   ├── main.tsx                         # 入口文件
│   ├── components/                      # React组件
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── CollectionManager/
│   │   │   ├── CollectionList.tsx
│   │   │   ├── CollectionCard.tsx
│   │   │   └── CreateCollectionModal.tsx
│   │   ├── DocumentManager/
│   │   │   ├── DocumentList.tsx
│   │   │   ├── DocumentUpload.tsx
│   │   │   └── DocumentCard.tsx
│   │   └── QAInterface/
│   │       ├── ChatWindow.tsx
│   │       ├── MessageBubble.tsx
│   │       ├── SourceCard.tsx
│   │       └── QueryInput.tsx
│   ├── hooks/                           # 自定义Hooks
│   │   ├── useCollections.ts
│   │   ├── useDocuments.ts
│   │   └── useQuery.ts
│   ├── services/                        # API服务
│   │   ├── api.ts
│   │   ├── collectionService.ts
│   │   ├── documentService.ts
│   │   └── queryService.ts
│   ├── types/                           # TypeScript类型
│   │   ├── collection.ts
│   │   ├── document.ts
│   │   └── query.ts
│   └── utils/
│       └── helpers.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 任务分解

### Task 1: 项目初始化和后端环境搭建

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`

- [ ] **Step 1: 创建后端目录结构**

```bash
mkdir -p backend/app/{models,schemas,api,core/rag,core/parsers,utils}
mkdir -p backend/tests/{test_models,test_api,test_core,test_schemas}
touch backend/app/__init__.py
touch backend/app/{models,schemas,api,core,utils}/__init__.py
touch backend/app/core/{rag,parsers}/__init__.py
touch backend/tests/__init__.py
```

- [ ] **Step 2: 创建requirements.txt**

```txt
# Web框架
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# 数据库
sqlalchemy==2.0.25
alembic==1.13.1

# RAG核心
llama-index==0.10.6
llama-index-vector-stores-chroma==0.1.4
chromadb==0.4.22

# 文档处理
pypdf==4.0.1
python-docx==1.1.0
beautifulsoup4==4.12.3
lxml==5.1.0

# AI模型
openai==1.10.0

# 工具
pydantic==2.5.3
pydantic-settings==2.1.0
python-dotenv==1.0.0

# 测试
pytest==7.4.4
pytest-asyncio==0.23.3
httpx==0.26.0
```

- [ ] **Step 3: 创建.env.example**

```env
# OpenAI配置
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-3.5-turbo
EMBEDDING_MODEL=text-embedding-ada-002

# 数据库配置
DATABASE_URL=sqlite:///./data/knowledge.db
CHROMA_PERSIST_DIR=./data/chroma

# 应用配置
APP_NAME=RAG Knowledge Base
DEBUG=true
```

- [ ] **Step 4: 创建配置管理**

Create: `backend/app/config.py`

```python
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # OpenAI配置
    openai_api_key: str
    openai_model: str = "gpt-3.5-turbo"
    embedding_model: str = "text-embedding-ada-002"

    # 数据库配置
    database_url: str = "sqlite:///./data/knowledge.db"
    chroma_persist_dir: str = "./data/chroma"

    # 应用配置
    app_name: str = "RAG Knowledge Base"
    debug: bool = False

    # 文档处理配置
    chunk_size: int = 512
    chunk_overlap: int = 50
    top_k: int = 3

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
```

- [ ] **Step 5: 提交初始配置**

```bash
cd /home/eryndor/code/Learn_RAG
git add backend/
git commit -m "chore: initialize backend project structure

- Create directory structure for backend
- Add requirements.txt with core dependencies
- Add .env.example template
- Add config.py for settings management

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 数据库模型和迁移

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models/collection.py`
- Create: `backend/app/models/document.py`
- Create: `backend/app/models/chunk.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_models/test_collection.py`

- [ ] **Step 1: 编写Collection模型的测试**

Create: `backend/tests/conftest.py`

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base


@pytest.fixture(scope="function")
def db_session():
    """创建测试数据库会话"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
```

Create: `backend/tests/test_models/test_collection.py`

```python
import pytest
from app.models.collection import Collection
from datetime import datetime


def test_create_collection(db_session):
    """测试创建知识库"""
    collection = Collection(
        name="RAG技术研究",
        description="关于RAG技术的相关论文",
        color="#1976d2"
    )
    db_session.add(collection)
    db_session.commit()

    assert collection.id is not None
    assert collection.name == "RAG技术研究"
    assert collection.document_count == 0
    assert isinstance(collection.created_at, datetime)


def test_collection_default_color(db_session):
    """测试默认颜色"""
    collection = Collection(name="测试知识库")
    db_session.add(collection)
    db_session.commit()

    assert collection.color == "#1976d2"
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd backend && python -m pytest tests/test_models/test_collection.py -v`

Expected: FAIL - "ModuleNotFoundError: No module named 'app'"

- [ ] **Step 3: 实现数据库基础配置**

Create: `backend/app/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}  # SQLite需要
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: 实现Collection模型**

Create: `backend/app/models/collection.py`

```python
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Collection(Base):
    """知识库模型"""
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String, default="")
    color = Column(String, default="#1976d2")
    document_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    documents = relationship("Document", back_populates="collection", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Collection {self.name}>"
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd backend && python -m pytest tests/test_models/test_collection.py -v`

Expected: PASS - 2 tests passed

- [ ] **Step 6: 实现Document和Chunk模型**

Create: `backend/app/models/document.py`

```python
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid
import enum


class FileType(str, enum.Enum):
    """文件类型"""
    PDF = "pdf"
    DOCX = "docx"
    MD = "md"
    TXT = "txt"


class Document(Base):
    """文档模型"""
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String, ForeignKey("collections.id"), nullable=False)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(SQLEnum(FileType), nullable=False)
    file_size = Column(Integer, default=0)
    upload_time = Column(DateTime, default=datetime.utcnow)

    # 关系
    collection = relationship("Collection", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Document {self.title}>"
```

Create: `backend/app/models/chunk.py`

```python
from sqlalchemy import Column, String, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


class Chunk(Base):
    """文档切片模型"""
    __tablename__ = "chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    page_num = Column(Integer, default=0)
    position = Column(Integer, default=0)

    # 关系
    document = relationship("Document", back_populates="chunks")

    def __repr__(self):
        return f"<Chunk {self.id[:8]}...>"
```

Update: `backend/app/models/__init__.py`

```python
from app.models.collection import Collection
from app.models.document import Document, FileType
from app.models.chunk import Chunk

__all__ = ["Collection", "Document", "Chunk", "FileType"]
```

- [ ] **Step 7: 提交数据库模型**

```bash
git add backend/
git commit -m "feat: add database models

- Add Collection model for knowledge base management
- Add Document model with file type enum
- Add Chunk model for document segments
- Add test fixtures and collection model tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Pydantic Schemas（API数据验证）

**Files:**
- Create: `backend/app/schemas/collection.py`
- Create: `backend/app/schemas/document.py`
- Create: `backend/app/schemas/query.py`
- Create: `backend/tests/test_schemas/test_collection_schema.py`

- [ ] **Step 1: 编写Collection Schema的测试**

Create: `backend/tests/test_schemas/test_collection_schema.py`

```python
import pytest
from app.schemas.collection import CollectionCreate, CollectionResponse


def test_collection_create_valid():
    """测试有效的创建数据"""
    data = {
        "name": "RAG技术研究",
        "description": "关于RAG技术的论文",
        "color": "#1976d2"
    }
    collection = CollectionCreate(**data)
    assert collection.name == "RAG技术研究"
    assert collection.color == "#1976d2"


def test_collection_create_minimal():
    """测试最小必填数据"""
    collection = CollectionCreate(name="测试知识库")
    assert collection.name == "测试知识库"
    assert collection.description == ""
    assert collection.color == "#1976d2"


def test_collection_create_invalid_color():
    """测试无效颜色格式"""
    with pytest.raises(ValueError):
        CollectionCreate(name="测试", color="invalid-color")
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd backend && python -m pytest tests/test_schemas/test_collection_schema.py -v`

Expected: FAIL - "ModuleNotFoundError: No module named 'app.schemas'"

- [ ] **Step 3: 实现Collection Schemas**

Create: `backend/app/schemas/collection.py`

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class CollectionBase(BaseModel):
    """知识库基础模型"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    color: str = Field(default="#1976d2", pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        """验证颜色格式"""
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("颜色必须是#RRGGBB格式")
        return v


class CollectionCreate(CollectionBase):
    """创建知识库请求"""
    pass


class CollectionUpdate(BaseModel):
    """更新知识库请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class CollectionResponse(CollectionBase):
    """知识库响应"""
    id: str
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd backend && python -m pytest tests/test_schemas/test_collection_schema.py -v`

Expected: PASS - 3 tests passed

- [ ] **Step 5: 实现Document和Query Schemas**

Create: `backend/app/schemas/document.py`

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.document import FileType


class DocumentBase(BaseModel):
    """文档基础模型"""
    title: str = Field(..., min_length=1, max_length=200)


class DocumentCreate(DocumentBase):
    """创建文档请求"""
    collection_id: str
    file_type: FileType


class DocumentResponse(DocumentBase):
    """文档响应"""
    id: str
    collection_id: str
    file_type: FileType
    file_size: int
    upload_time: datetime

    class Config:
        from_attributes = True


class SourceResponse(BaseModel):
    """来源响应"""
    document_id: str
    title: str
    page: int
    snippet: str
    relevance_score: float
    collection_name: str
```

Create: `backend/app/schemas/query.py`

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.document import SourceResponse


class QueryRequest(BaseModel):
    """查询请求"""
    question: str = Field(..., min_length=1, max_length=1000)
    collection_id: Optional[str] = None
    search_all: bool = False
    top_k: int = Field(default=3, ge=1, le=10)
    include_sources: bool = True


class QueryResponse(BaseModel):
    """查询响应"""
    answer: str
    sources: List[SourceResponse]
    confidence: float
    response_time: float
```

Update: `backend/app/schemas/__init__.py`

```python
from app.schemas.collection import (
    CollectionCreate,
    CollectionUpdate,
    CollectionResponse
)
from app.schemas.document import (
    DocumentCreate,
    DocumentResponse,
    SourceResponse
)
from app.schemas.query import QueryRequest, QueryResponse

__all__ = [
    "CollectionCreate", "CollectionUpdate", "CollectionResponse",
    "DocumentCreate", "DocumentResponse", "SourceResponse",
    "QueryRequest", "QueryResponse"
]
```

- [ ] **Step 6: 提交Schemas**

```bash
git add backend/
git commit -m "feat: add Pydantic schemas for API validation

- Add Collection schemas with color validation
- Add Document and Source schemas
- Add Query request/response schemas
- Add schema tests with validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: 文档解析器（PDF和Markdown）

**Files:**
- Create: `backend/app/core/parsers/base_parser.py`
- Create: `backend/app/core/parsers/pdf_parser.py`
- Create: `backend/app/core/parsers/markdown_parser.py`
- Create: `backend/tests/test_core/test_parsers.py`

- [ ] **Step 1: 编写文档解析器的测试**

Create: `backend/tests/test_core/test_parsers.py`

```python
import pytest
from app.core.parsers.pdf_parser import PDFParser
from app.core.parsers.markdown_parser import MarkdownParser


def test_markdown_parser_extract_text():
    """测试Markdown文本提取"""
    content = "# 标题\n\n这是正文内容。"
    parser = MarkdownParser(content)
    text = parser.extract_text()
    assert "标题" in text
    assert "正文内容" in text


def test_markdown_parser_chunk_text():
    """测试Markdown文本切分"""
    content = "这是第一段。\n\n这是第二段。\n\n这是第三段。"
    parser = MarkdownParser(content)
    chunks = parser.chunk_text(chunk_size=20, overlap=5)
    assert len(chunks) > 0
    assert all(len(chunk) <= 25 for chunk in chunks)  # 考虑overlap


def test_pdf_parser_file_not_found():
    """测试PDF文件不存在"""
    with pytest.raises(FileNotFoundError):
        PDFParser("nonexistent.pdf")
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd backend && python -m pytest tests/test_core/test_parsers.py -v`

Expected: FAIL - "ModuleNotFoundError"

- [ ] **Step 3: 实现基础解析器接口**

Create: `backend/app/core/parsers/base_parser.py`

```python
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
```

- [ ] **Step 4: 实现Markdown解析器**

Create: `backend/app/core/parsers/markdown_parser.py`

```python
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
```

- [ ] **Step 5: 实现PDF解析器**

Create: `backend/app/core/parsers/pdf_parser.py`

```python
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
```

- [ ] **Step 6: 实现Word解析器**

Create: `backend/app/core/parsers/word_parser.py`

```python
from typing import List
from docx import Document
from app.core.parsers.base_parser import BaseParser


class WordParser(BaseParser):
    """Word文档解析器"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.document = self._load_document()

    def _load_document(self) -> Document:
        """加载Word文档"""
        try:
            return Document(self.file_path)
        except FileNotFoundError:
            raise FileNotFoundError(f"Word文档不存在: {self.file_path}")

    def extract_text(self) -> str:
        """提取Word文档全部文本"""
        text = ""
        for paragraph in self.document.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()

    def chunk_text(self, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """按段落和大小切分Word文本"""
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
```

- [ ] **Step 7: 运行测试验证通过**

- [ ] **Step 6: 运行测试验证通过**

Run: `cd backend && python -m pytest tests/test_core/test_parsers.py -v`

Expected: PASS - 3 tests passed

- [ ] **Step 7: 提交解析器实现**

```bash
git add backend/
git commit -m "feat: add document parsers

- Add BaseParser abstract class
- Add MarkdownParser with paragraph-based chunking
- Add PDFParser using pypdf
- Add parser tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: RAG核心引擎（向量化、检索、生成）

**Files:**
- Create: `backend/app/core/rag/embeddings.py`
- Create: `backend/app/core/rag/vector_store.py`
- Create: `backend/app/core/rag/retriever.py`
- Create: `backend/app/core/rag/generator.py`
- Create: `backend/tests/test_core/test_rag.py`

- [ ] **Step 1: 编写Embedding和检索的测试**

Create: `backend/tests/test_core/test_rag.py`

```python
import pytest
from unittest.mock import Mock, patch
from app.core.rag.embeddings import EmbeddingEngine


@patch("app.core.rag.embeddings.OpenAI")
def test_embedding_engine_embed_text(mock_openai):
    """测试文本向量化"""
    mock_client = Mock()
    mock_openai.return_value = mock_client
    mock_client.embeddings.create.return_value = Mock(
        data=[Mock(embedding=[0.1, 0.2, 0.3])]
    )

    engine = EmbeddingEngine(api_key="test-key")
    embedding = engine.embed_text("测试文本")

    assert isinstance(embedding, list)
    assert len(embedding) == 3
    assert embedding == [0.1, 0.2, 0.3]


def test_embedding_engine_embed_batch():
    """测试批量向量化"""
    with patch("app.core.rag.embeddings.OpenAI") as mock_openai:
        mock_client = Mock()
        mock_openai.return_value = mock_client
        mock_client.embeddings.create.return_value = Mock(
            data=[Mock(embedding=[0.1, 0.2]) for _ in range(3)]
        )

        engine = EmbeddingEngine(api_key="test-key")
        texts = ["文本1", "文本2", "文本3"]
        embeddings = engine.embed_batch(texts)

        assert len(embeddings) == 3
        assert all(len(e) == 2 for e in embeddings)
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd backend && python -m pytest tests/test_core/test_rag.py::test_embedding_engine_embed_text -v`

Expected: FAIL - "ModuleNotFoundError"

- [ ] **Step 3: 实现Embedding引擎**

Create: `backend/app/core/rag/embeddings.py`

```python
from typing import List
from openai import OpenAI
from app.config import settings


class EmbeddingEngine:
    """文本向量化引擎"""

    def __init__(self, api_key: str = None, model: str = None):
        self.client = OpenAI(api_key=api_key or settings.openai_api_key)
        self.model = model or settings.embedding_model

    def embed_text(self, text: str) -> List[float]:
        """单个文本向量化"""
        response = self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批量文本向量化"""
        response = self.client.embeddings.create(
            input=texts,
            model=self.model
        )
        return [item.embedding for item in response.data]
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd backend && python -m pytest tests/test_core/test_rag.py -v`

Expected: PASS - 2 tests passed

- [ ] **Step 5: 实现向量存储（Chroma集成）**

Create: `backend/app/core/rag/vector_store.py`

```python
from typing import List, Dict, Optional
import chromadb
from chromadb.config import Settings
from app.config import settings


class VectorStore:
    """Chroma向量存储"""

    def __init__(self, persist_dir: str = None):
        self.client = chromadb.Client(Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_dir or settings.chroma_persist_dir
        ))

    def create_collection(self, collection_name: str):
        """创建集合"""
        return self.client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def get_collection(self, collection_name: str):
        """获取集合"""
        return self.client.get_collection(name=collection_name)

    def delete_collection(self, collection_name: str):
        """删除集合"""
        self.client.delete_collection(name=collection_name)

    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict]] = None,
        ids: Optional[List[str]] = None
    ):
        """添加文档到向量库"""
        collection = self.get_collection(collection_name)
        collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

    def search(
        self,
        collection_name: str,
        query_embedding: List[float],
        top_k: int = 3
    ) -> Dict:
        """检索相似文档"""
        collection = self.get_collection(collection_name)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        return results
```

- [ ] **Step 6: 实现检索器**

Create: `backend/app/core/rag/retriever.py`

```python
from typing import List, Dict
from app.core.rag.embeddings import EmbeddingEngine
from app.core.rag.vector_store import VectorStore


class Retriever:
    """文档检索器"""

    def __init__(self, vector_store: VectorStore = None, embedding_engine: EmbeddingEngine = None):
        self.vector_store = vector_store or VectorStore()
        self.embedding_engine = embedding_engine or EmbeddingEngine()

    def retrieve(
        self,
        query: str,
        collection_name: str,
        top_k: int = 3
    ) -> List[Dict]:
        """检索相关文档"""
        # 向量化查询
        query_embedding = self.embedding_engine.embed_text(query)

        # 检索相似文档
        results = self.vector_store.search(
            collection_name=collection_name,
            query_embedding=query_embedding,
            top_k=top_k
        )

        # 格式化结果
        formatted_results = []
        for i in range(len(results['documents'][0])):
            formatted_results.append({
                'content': results['documents'][0][i],
                'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                'distance': results['distances'][0][i] if results['distances'] else 0,
                'id': results['ids'][0][i]
            })

        return formatted_results
```

- [ ] **Step 7: 实现生成器**

Create: `backend/app/core/rag/generator.py`

```python
from typing import List
from openai import OpenAI
from app.config import settings


class Generator:
    """答案生成器"""

    def __init__(self, api_key: str = None, model: str = None):
        self.client = OpenAI(api_key=api_key or settings.openai_api_key)
        self.model = model or settings.openai_model

    def generate_answer(
        self,
        question: str,
        contexts: List[str],
        max_tokens: int = 1000
    ) -> str:
        """基于上下文生成答案"""
        # 构建提示词
        context_text = "\n\n".join([f"[{i+1}] {ctx}" for i, ctx in enumerate(contexts)])

        prompt = f"""基于以下参考内容回答问题。请在答案中标注引用来源，格式为[1]、[2]等。

参考内容：
{context_text}

问题：{question}

答案："""

        # 调用LLM
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个专业的问答助手，善于基于提供的参考资料给出准确、有引用的答案。"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=0.7
        )

        return response.choices[0].message.content
```

- [ ] **Step 8: 提交RAG核心引擎**

```bash
git add backend/
git commit -m "feat: implement RAG core engine

- Add EmbeddingEngine using OpenAI embeddings
- Add VectorStore with Chroma integration
- Add Retriever for semantic search
- Add Generator for answer generation
- Add RAG component tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: FastAPI应用和API路由

**Files:**
- Create: `backend/app/api/collections.py`
- Create: `backend/app/api/documents.py`
- Create: `backend/app/api/query.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/test_api/test_collections.py`

- [ ] **Step 1: 编写Collections API的测试**

Create: `backend/tests/test_api/test_collections.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_create_collection():
    """测试创建知识库"""
    response = client.post(
        "/api/collections",
        json={
            "name": "测试知识库",
            "description": "测试描述",
            "color": "#ff0000"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试知识库"
    assert data["color"] == "#ff0000"
    assert "id" in data


def test_list_collections():
    """测试获取知识库列表"""
    # 先创建一个知识库
    client.post("/api/collections", json={"name": "列表测试"})

    response = client.get("/api/collections")
    assert response.status_code == 200
    data = response.json()
    assert "collections" in data
    assert isinstance(data["collections"], list)


def test_get_collection():
    """测试获取单个知识库"""
    # 先创建
    create_response = client.post(
        "/api/collections",
        json={"name": "获取测试"}
    )
    collection_id = create_response.json()["id"]

    # 再获取
    response = client.get(f"/api/collections/{collection_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "获取测试"


def test_delete_collection():
    """测试删除知识库"""
    # 先创建
    create_response = client.post(
        "/api/collections",
        json={"name": "删除测试"}
    )
    collection_id = create_response.json()["id"]

    # 再删除
    response = client.delete(f"/api/collections/{collection_id}")
    assert response.status_code == 200

    # 确认已删除
    get_response = client.get(f"/api/collections/{collection_id}")
    assert get_response.status_code == 404
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd backend && python -m pytest tests/test_api/test_collections.py -v`

Expected: FAIL - "ModuleNotFoundError"

- [ ] **Step 3: 实现Collections API**

Create: `backend/app/api/collections.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Collection
from app.schemas import CollectionCreate, CollectionUpdate, CollectionResponse

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.post("", response_model=CollectionResponse)
def create_collection(
    collection: CollectionCreate,
    db: Session = Depends(get_db)
):
    """创建知识库"""
    db_collection = Collection(**collection.model_dump())
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection


@router.get("")
def list_collections(db: Session = Depends(get_db)):
    """获取知识库列表"""
    collections = db.query(Collection).all()
    return {"collections": [CollectionResponse.model_validate(c) for c in collections]}


@router.get("/{collection_id}", response_model=CollectionResponse)
def get_collection(collection_id: str, db: Session = Depends(get_db)):
    """获取单个知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return collection


@router.put("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: str,
    collection_update: CollectionUpdate,
    db: Session = Depends(get_db)
):
    """更新知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    update_data = collection_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(collection, key, value)

    db.commit()
    db.refresh(collection)
    return collection


@router.delete("/{collection_id}")
def delete_collection(collection_id: str, db: Session = Depends(get_db)):
    """删除知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    db.delete(collection)
    db.commit()
    return {"success": True, "message": "知识库已删除"}
```

- [ ] **Step 4: 实现Documents API（简化版）**

Create: `backend/app/api/documents.py`

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Document, FileType
from app.schemas import DocumentResponse
import os
import uuid

router = APIRouter(prefix="/api/collections/{collection_id}/documents", tags=["documents"])


@router.post("", response_model=DocumentResponse)
async def upload_document(
    collection_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传文档"""
    # 确定文件类型
    filename = file.filename
    if filename.endswith('.pdf'):
        file_type = FileType.PDF
    elif filename.endswith('.md'):
        file_type = FileType.MD
    elif filename.endswith('.docx'):
        file_type = FileType.DOCX
    else:
        raise HTTPException(status_code=400, detail="不支持的文件类型")

    # 保存文件
    file_id = str(uuid.uuid4())
    file_path = f"./uploads/{file_id}_{filename}"
    os.makedirs("./uploads", exist_ok=True)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # 创建文档记录
    document = Document(
        collection_id=collection_id,
        title=filename,
        file_path=file_path,
        file_type=file_type,
        file_size=len(content)
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return document


@router.get("", response_model=List[DocumentResponse])
def list_documents(collection_id: str, db: Session = Depends(get_db)):
    """获取文档列表"""
    documents = db.query(Document).filter(
        Document.collection_id == collection_id
    ).all()
    return documents
```

- [ ] **Step 5: 实现Query API**

Create: `backend/app/api/query.py`

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import QueryRequest, QueryResponse
from app.core.rag.retriever import Retriever
from app.core.rag.generator import Generator
import time

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("", response_model=QueryResponse)
def query(request: QueryRequest, db: Session = Depends(get_db)):
    """智能问答"""
    start_time = time.time()

    # 初始化组件
    retriever = Retriever()
    generator = Generator()

    # 检索相关文档
    collection_name = request.collection_id if not request.search_all else "all"
    results = retriever.retrieve(
        query=request.question,
        collection_name=collection_name,
        top_k=request.top_k
    )

    # 生成答案
    contexts = [r['content'] for r in results]
    answer = generator.generate_answer(
        question=request.question,
        contexts=contexts
    )

    # 计算响应时间
    response_time = time.time() - start_time

    # 构建来源响应
    from app.schemas.document import SourceResponse
    sources = [
        SourceResponse(
            document_id=r['metadata'].get('document_id', ''),
            title=r['metadata'].get('title', '未知文档'),
            page=r['metadata'].get('page', 0),
            snippet=r['content'][:200],
            relevance_score=1 - r['distance'],
            collection_name=r['metadata'].get('collection_name', '')
        )
        for r in results
    ]

    return QueryResponse(
        answer=answer,
        sources=sources,
        confidence=sum(1 - r['distance'] for r in results) / len(results),
        response_time=response_time
    )
```

- [ ] **Step 6: 创建主应用**

Create: `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api import collections, documents, query

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
    allow_origins=["http://localhost:3000"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(collections.router)
app.include_router(documents.router)
app.include_router(query.router)


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

- [ ] **Step 7: 运行测试验证通过**

Run: `cd backend && python -m pytest tests/test_api/test_collections.py -v`

Expected: PASS - 4 tests passed

- [ ] **Step 8: 提交API实现**

```bash
git add backend/
git commit -m "feat: implement FastAPI application and API routes

- Add Collections API with CRUD operations
- Add Documents API with file upload
- Add Query API for RAG问答
- Add main FastAPI application with CORS
- Add API tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: 文档处理管道集成

**Files:**
- Create: `backend/app/core/rag/document_processor.py`
- Modify: `backend/app/api/documents.py`
- Create: `backend/tests/test_core/test_document_processor.py`

- [ ] **Step 1: 编写文档处理器的测试**

Create: `backend/tests/test_core/test_document_processor.py`

```python
import pytest
from unittest.mock import Mock, patch
from app.core.rag.document_processor import DocumentProcessor


@patch("app.core.rag.document_processor.EmbeddingEngine")
@patch("app.core.rag.document_processor.PDFParser")
def test_document_processor_process_pdf(mock_parser, mock_embedding):
    """测试PDF文档处理"""
    # Mock解析器
    mock_parser_instance = Mock()
    mock_parser.return_value = mock_parser_instance
    mock_parser_instance.extract_text.return_value = "测试内容"
    mock_parser_instance.chunk_text.return_value = ["片段1", "片段2"]

    # Mock向量化引擎
    mock_embedding_instance = Mock()
    mock_embedding.return_value = mock_embedding_instance
    mock_embedding_instance.embed_batch.return_value = [[0.1, 0.2], [0.3, 0.4]]

    processor = DocumentProcessor()
    result = processor.process_document(
        file_path="test.pdf",
        collection_id="test-collection"
    )

    assert result['success'] is True
    assert result['chunk_count'] == 2
```

- [ ] **Step 2: 实现文档处理器**

Create: `backend/app/core/rag/document_processor.py`

```python
from typing import Dict, List
from app.core.parsers.pdf_parser import PDFParser
from app.core.parsers.markdown_parser import MarkdownParser
from app.core.rag.embeddings import EmbeddingEngine
from app.core.rag.vector_store import VectorStore
from app.models.document import FileType
import uuid


class DocumentProcessor:
    """文档处理管道"""

    def __init__(self):
        self.embedding_engine = EmbeddingEngine()
        self.vector_store = VectorStore()

    def process_document(
        self,
        file_path: str,
        collection_id: str,
        file_type: FileType,
        chunk_size: int = 512,
        overlap: int = 50
    ) -> Dict:
        """处理文档：解析 -> 切分 -> 向量化 -> 存储"""

        # 1. 选择解析器
        if file_type == FileType.PDF:
            parser = PDFParser(file_path)
        elif file_type == FileType.DOCX:
            parser = WordParser(file_path)
        elif file_type == FileType.MD:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            parser = MarkdownParser(content)
        else:
            raise ValueError(f"不支持的文件类型: {file_type}")

        # 2. 提取文本
        text = parser.extract_text()

        # 3. 切分文本
        chunks = parser.chunk_text(chunk_size=chunk_size, overlap=overlap)

        # 4. 批量向量化
        embeddings = self.embedding_engine.embed_batch(chunks)

        # 5. 存储到向量库
        chunk_ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [
            {
                "document_id": file_path,
                "collection_id": collection_id,
                "chunk_index": i
            }
            for i in range(len(chunks))
        ]

        self.vector_store.add_documents(
            collection_name=collection_id,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=chunk_ids
        )

        return {
            "success": True,
            "chunk_count": len(chunks),
            "chunk_ids": chunk_ids
        }
```

- [ ] **Step 3: 集成到Documents API**

Update: `backend/app/api/documents.py` - 在upload_document函数中添加处理调用

```python
from app.core.rag.document_processor import DocumentProcessor

@router.post("", response_model=DocumentResponse)
async def upload_document(
    collection_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传文档并处理"""
    # ... 现有的文件保存代码 ...

    # 创建文档记录
    document = Document(
        collection_id=collection_id,
        title=filename,
        file_path=file_path,
        file_type=file_type,
        file_size=len(content)
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # 处理文档（解析、向量化、存储）
    try:
        processor = DocumentProcessor()
        result = processor.process_document(
            file_path=file_path,
            collection_id=collection_id,
            file_type=file_type
        )

        # 更新文档状态
        document.metadata = {"processed": True, "chunk_count": result['chunk_count']}
        db.commit()

    except Exception as e:
        # 处理失败，记录错误
        document.metadata = {"processed": False, "error": str(e)}
        db.commit()

    return document
```

- [ ] **Step 4: 提交文档处理器**

```bash
git add backend/
git commit -m "feat: add document processing pipeline

- Add DocumentProcessor to orchestrate parse->chunk->embed->store
- Integrate processor into Documents API upload endpoint
- Add document processor tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: 前端项目初始化

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: 初始化Vite项目**

```bash
cd /home/eryndor/code/Learn_RAG
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: 安装依赖**

```bash
npm install tailwindcss postcss autoprefixer
npm install @tanstack/react-query axios
npm install lucide-react clsx tailwind-merge
npm install -D @types/node
```

- [ ] **Step 3: 配置Tailwind CSS**

Create: `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Create: `frontend/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900;
}
```

- [ ] **Step 4: 创建基础App组件**

Create: `frontend/src/App.tsx`

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold p-4">RAG知识库系统</h1>
      </div>
    </QueryClientProvider>
  )
}

export default App
```

- [ ] **Step 5: 提交前端初始化**

```bash
git add frontend/
git commit -m "chore: initialize frontend with Vite + React + Tailwind

- Create Vite React TypeScript project
- Add Tailwind CSS configuration
- Add React Query for state management
- Add basic App component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: API服务层和类型定义

**Files:**
- Create: `frontend/src/types/collection.ts`
- Create: `frontend/src/types/document.ts`
- Create: `frontend/src/types/query.ts`
- Create: `frontend/src/services/api.ts`
- Create: `frontend/src/services/collectionService.ts`
- Create: `frontend/src/services/documentService.ts`
- Create: `frontend/src/services/queryService.ts`

- [ ] **Step 1: 定义TypeScript类型**

Create: `frontend/src/types/collection.ts`

```typescript
export interface Collection {
  id: string
  name: string
  description: string
  color: string
  document_count: number
  created_at: string
  updated_at: string
}

export interface CollectionCreate {
  name: string
  description?: string
  color?: string
}
```

Create: `frontend/src/types/document.ts`

```typescript
export type FileType = 'pdf' | 'docx' | 'md' | 'txt'

export interface Document {
  id: string
  collection_id: string
  title: string
  file_type: FileType
  file_size: number
  upload_time: string
}

export interface Source {
  document_id: string
  title: string
  page: number
  snippet: string
  relevance_score: number
  collection_name: string
}
```

Create: `frontend/src/types/query.ts`

```typescript
import { Source } from './document'

export interface QueryRequest {
  question: string
  collection_id?: string
  search_all?: boolean
  top_k?: number
  include_sources?: boolean
}

export interface QueryResponse {
  answer: string
  sources: Source[]
  confidence: number
  response_time: number
}
```

- [ ] **Step 2: 创建API客户端**

Create: `frontend/src/services/api.ts`

```typescript
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

- [ ] **Step 3: 实现Collection服务**

Create: `frontend/src/services/collectionService.ts`

```typescript
import { apiClient } from './api'
import { Collection, CollectionCreate } from '../types/collection'

export const collectionService = {
  async list(): Promise<Collection[]> {
    const response = await apiClient.get<{ collections: Collection[] }>('/api/collections')
    return response.data.collections
  },

  async get(id: string): Promise<Collection> {
    const response = await apiClient.get<Collection>(`/api/collections/${id}`)
    return response.data
  },

  async create(data: CollectionCreate): Promise<Collection> {
    const response = await apiClient.post<Collection>('/api/collections', data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/collections/${id}`)
  },
}
```

- [ ] **Step 4: 实现Query服务**

Create: `frontend/src/services/queryService.ts`

```typescript
import { apiClient } from './api'
import { QueryRequest, QueryResponse } from '../types/query'

export const queryService = {
  async query(request: QueryRequest): Promise<QueryResponse> {
    const response = await apiClient.post<QueryResponse>('/api/query', request)
    return response.data
  },
}
```

- [ ] **Step 5: 提交服务层**

```bash
git add frontend/
git commit -m "feat: add frontend API services and types

- Add TypeScript type definitions
- Add API client with axios
- Add collection, document, and query services

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: 布局组件

**Files:**
- Create: `frontend/src/components/Layout/MainLayout.tsx`
- Create: `frontend/src/components/Layout/Header.tsx`

- [ ] **Step 1: 创建Header组件**

Create: `frontend/src/components/Layout/Header.tsx`

```tsx
import { FileText, MessageSquare, BookOpen } from 'lucide-react'

export function Header() {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            RAG知识库系统
          </h1>
          <nav className="flex gap-6 text-sm">
            <a href="#" className="flex items-center gap-1 hover:underline">
              <FileText className="w-4 h-4" />
              知识库
            </a>
            <a href="#" className="flex items-center gap-1 hover:underline">
              <MessageSquare className="w-4 h-4" />
              问答
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: 创建MainLayout组件**

Create: `frontend/src/components/Layout/MainLayout.tsx`

```tsx
import { ReactNode } from 'react'
import { Header } from './Header'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: 提交布局组件**

```bash
git add frontend/
git commit -m "feat: add layout components

- Add Header with navigation
- Add MainLayout wrapper component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: 知识库管理组件

**Files:**
- Create: `frontend/src/components/CollectionManager/CollectionList.tsx`
- Create: `frontend/src/components/CollectionManager/CollectionCard.tsx`
- Create: `frontend/src/components/CollectionManager/CreateCollectionModal.tsx`
- Create: `frontend/src/hooks/useCollections.ts`

- [ ] **Step 1: 创建useCollections Hook**

Create: `frontend/src/hooks/useCollections.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionService } from '../services/collectionService'
import { CollectionCreate } from '../types/collection'

export function useCollections() {
  const queryClient = useQueryClient()

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionService.list,
  })

  const createMutation = useMutation({
    mutationFn: collectionService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: collectionService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  return {
    collections,
    isLoading,
    createCollection: createMutation.mutate,
    deleteCollection: deleteMutation.mutate,
  }
}
```

- [ ] **Step 2: 创建CollectionCard组件**

Create: `frontend/src/components/CollectionManager/CollectionCard.tsx`

```tsx
import { Folder, Trash2 } from 'lucide-react'
import { Collection } from '../../types/collection'

interface CollectionCardProps {
  collection: Collection
  onClick: () => void
  onDelete: () => void
}

export function CollectionCard({ collection, onClick, onDelete }: CollectionCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeftColor: collection.color }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Folder className="w-4 h-4" style={{ color: collection.color }} />
            <h3 className="font-semibold text-sm">{collection.name}</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">{collection.description}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{collection.document_count} 篇文档</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建CollectionList组件**

Create: `frontend/src/components/CollectionManager/CollectionList.tsx`

```tsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCollections } from '../../hooks/useCollections'
import { CollectionCard } from './CollectionCard'
import { CreateCollectionModal } from './CreateCollectionModal'

interface CollectionListProps {
  onSelectCollection: (id: string) => void
}

export function CollectionList({ onSelectCollection }: CollectionListProps) {
  const { collections, isLoading, createCollection, deleteCollection } = useCollections()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">知识库</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          新建
        </button>
      </div>

      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onClick={() => onSelectCollection(collection.id)}
          onDelete={() => deleteCollection(collection.id)}
        />
      ))}

      {collections.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          还没有知识库，点击"新建"创建第一个
        </div>
      )}

      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createCollection}
      />
    </div>
  )
}
```

- [ ] **Step 4: 创建CreateCollectionModal组件**

Create: `frontend/src/components/CollectionManager/CreateCollectionModal.tsx`

```tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { CollectionCreate } from '../../types/collection'

interface CreateCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CollectionCreate) => void
}

export function CreateCollectionModal({ isOpen, onClose, onSubmit }: CreateCollectionModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#1976d2')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, description, color })
    setName('')
    setDescription('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">创建知识库</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">颜色</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-10 rounded-md"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            创建
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 提交知识库管理组件**

```bash
git add frontend/
git commit -m "feat: add collection management components

- Add useCollections hook with React Query
- Add CollectionCard component
- Add CollectionList component
- Add CreateCollectionModal component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: 问答界面组件

**Files:**
- Create: `frontend/src/components/QAInterface/ChatWindow.tsx`
- Create: `frontend/src/components/QAInterface/MessageBubble.tsx`
- Create: `frontend/src/components/QAInterface/QueryInput.tsx`
- Create: `frontend/src/components/QAInterface/SourceCard.tsx`
- Create: `frontend/src/hooks/useQuery.ts`

- [ ] **Step 1: 创建useQuery Hook**

Create: `frontend/src/hooks/useQuery.ts`

```typescript
import { useMutation } from '@tanstack/react-query'
import { queryService } from '../services/queryService'
import { QueryRequest, QueryResponse } from '../types/query'

export function useQuery() {
  const mutation = useMutation({
    mutationFn: (request: QueryRequest) => queryService.query(request),
  })

  return {
    query: mutation.mutate,
    data: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
}
```

- [ ] **Step 2: 创建MessageBubble组件**

Create: `frontend/src/components/QAInterface/MessageBubble.tsx`

```tsx
import { ReactNode } from 'react'

interface MessageBubbleProps {
  type: 'user' | 'ai'
  children: ReactNode
}

export function MessageBubble({ type, children }: MessageBubbleProps) {
  const isUser = type === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg ${
          isUser
            ? 'bg-blue-100 text-blue-900'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="font-semibold text-xs mb-1">
          {isUser ? '你' : 'AI'}
        </div>
        <div className="text-sm whitespace-pre-wrap">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建SourceCard组件**

Create: `frontend/src/components/QAInterface/SourceCard.tsx`

```tsx
import { FileText } from 'lucide-react'
import { Source } from '../../types/document'

interface SourceCardProps {
  source: Source
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="bg-white p-3 rounded-lg border-l-4 border-blue-500 shadow-sm">
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-blue-500 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{source.title}</div>
          <div className="text-xs text-gray-600 mt-1">
            第{source.page}页
          </div>
          <div className="text-xs text-gray-500 mt-2 line-clamp-2">
            {source.snippet}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            相关性: {(source.relevance_score * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 创建QueryInput组件**

Create: `frontend/src/components/QAInterface/QueryInput.tsx`

```tsx
import { useState } from 'react'
import { Send } from 'lucide-react'

interface QueryInputProps {
  onSubmit: (question: string) => void
  disabled?: boolean
}

export function QueryInput({ onSubmit, disabled }: QueryInputProps) {
  const [question, setQuestion] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (question.trim()) {
      onSubmit(question)
      setQuestion('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="输入你的问题..."
        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !question.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  )
}
```

- [ ] **Step 5: 创建ChatWindow组件**

Create: `frontend/src/components/QAInterface/ChatWindow.tsx`

```tsx
import { useState } from 'react'
import { MessageBubble } from './MessageBubble'
import { QueryInput } from './QueryInput'
import { SourceCard } from './SourceCard'
import { useQuery } from '../../hooks/useQuery'

interface ChatWindowProps {
  collectionId: string | null
}

interface Message {
  type: 'user' | 'ai'
  content: string
  sources?: any[]
}

export function ChatWindow({ collectionId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const { query, isLoading, data } = useQuery()

  const handleQuery = (question: string) => {
    // 添加用户消息
    setMessages((prev) => [...prev, { type: 'user', content: question }])

    // 发送查询
    query(
      {
        question,
        collection_id: collectionId || undefined
      },
      {
        onSuccess: (response) => {
          // 添加AI回复
          setMessages((prev) => [
            ...prev,
            {
              type: 'ai',
              content: response.answer,
              sources: response.sources,
            },
          ])
        },
      }
    )
  }

  return (
    <div className="flex flex-col h-[600px] bg-gray-50 rounded-lg">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <MessageBubble type={msg.type}>{msg.content}</MessageBubble>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="text-xs font-semibold text-gray-600 mb-2">
                  参考来源:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {msg.sources.map((source, sIdx) => (
                    <SourceCard key={sIdx} source={source} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <MessageBubble type="ai">思考中...</MessageBubble>
        )}
      </div>

      {/* 输入框 */}
      <div className="p-4 border-t bg-white">
        <QueryInput onSubmit={handleQuery} disabled={isLoading} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 提交问答界面组件**

```bash
git add frontend/
git commit -m "feat: add QA interface components

- Add useQuery hook
- Add MessageBubble component
- Add SourceCard component
- Add QueryInput component
- Add ChatWindow component with full chat flow

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: 主应用集成

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 集成所有组件到App**

Update: `frontend/src/App.tsx`

```tsx
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './components/Layout/MainLayout'
import { CollectionList } from './components/CollectionManager/CollectionList'
import { ChatWindow } from './components/QAInterface/ChatWindow'

const queryClient = new QueryClient()

function App() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <div className="flex gap-6">
          {/* 左侧：知识库列表 */}
          <div className="w-80 flex-shrink-0">
            <CollectionList
              onSelectCollection={setSelectedCollection}
            />
          </div>

          {/* 右侧：问答界面 */}
          <div className="flex-1">
            <ChatWindow collectionId={selectedCollection} />
          </div>
        </div>
      </MainLayout>
    </QueryClientProvider>
  )
}

export default App
```

- [ ] **Step 2: 提交应用集成**

```bash
git add frontend/
git commit -m "feat: integrate all components in App

- Combine CollectionList and ChatWindow
- Add collection selection state
- Complete main application layout

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 14: Docker部署配置

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `backend/app/init_db.py`

- [ ] **Step 1: 创建后端Dockerfile**

Create: `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/data /app/uploads

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: 创建前端Dockerfile**

Create: `frontend/Dockerfile`

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: 创建nginx配置**

Create: `frontend/nginx.conf`

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] **Step 4: 创建docker-compose.yml**

Create: `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_URL=sqlite:///./data/knowledge.db
      - CHROMA_PERSIST_DIR=/app/data/chroma
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend
    restart: unless-stopped
```

- [ ] **Step 4: 创建数据库初始化脚本**

Create: `backend/app/init_db.py`

```python
from app.database import engine, Base
from app.models import Collection, Document, Chunk

def init_db():
    """初始化数据库"""
    Base.metadata.create_all(bind=engine)
    print("数据库表已创建")

if __name__ == "__main__":
    init_db()
```

- [ ] **Step 5: 提交Docker配置**

```bash
git add .
git commit -m "feat: add Docker deployment configuration

- Add backend Dockerfile
- Add frontend Dockerfile with multi-stage build
- Add docker-compose.yml for orchestration
- Add database initialization script

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 15: 端到端测试和文档

**Files:**
- Create: `README.md`
- Create: `tests/e2e_test.py`
- Modify: `.env.example`

- [ ] **Step 1: 创建README文档**

Create: `README.md`

```markdown
# 企业级RAG知识库系统

基于RAG技术的智能文档问答系统，专为论文和学术文档管理设计。

## 功能特性

- ✅ 知识库分类管理
- ✅ 文档上传和智能解析
- ✅ 语义检索和智能问答
- ✅ 来源追溯和引用展示
- ✅ 本地部署，数据安全

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+
- OpenAI API Key

### 后端启动

\`\`\`bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # 填写API密钥
uvicorn app.main:app --reload
\`\`\`

### 前端启动

\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

### Docker部署

\`\`\`bash
docker-compose up -d
\`\`\`

## 使用说明

1. 创建知识库
2. 上传文档（PDF/Markdown）
3. 开始智能问答

## API文档

访问 http://localhost:8000/docs 查看完整API文档
```

- [ ] **Step 2: 创建端到端测试**

Create: `tests/e2e_test.py`

```python
import pytest
import httpx
import time

BASE_URL = "http://localhost:8000"


def test_e2e_workflow():
    """端到端工作流测试"""

    # 1. 创建知识库
    response = httpx.post(f"{BASE_URL}/api/collections", json={
        "name": "E2E测试知识库",
        "description": "端到端测试"
    })
    assert response.status_code == 200
    collection_id = response.json()["id"]

    # 2. 上传文档
    with open("test_document.pdf", "rb") as f:
        response = httpx.post(
            f"{BASE_URL}/api/collections/{collection_id}/documents",
            files={"file": f}
        )
    assert response.status_code == 200
    document_id = response.json()["id"]

    # 等待处理完成
    time.sleep(5)

    # 3. 查询
    response = httpx.post(f"{BASE_URL}/api/query", json={
        "question": "这个文档讲了什么？",
        "collection_id": collection_id
    })
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["sources"]) > 0

    # 4. 清理
    httpx.delete(f"{BASE_URL}/api/collections/{collection_id}")
```

- [ ] **Step 3: 最终提交**

```bash
git add .
git commit -m "docs: add README and e2e tests

- Add comprehensive README with setup instructions
- Add end-to-end workflow test
- Update .env.example with all required variables

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收标准

### 功能验收
- [ ] 可以创建、查看、删除知识库
- [ ] 可以上传PDF/Markdown文档
- [ ] 文档能被正确解析和向量化
- [ ] 可以进行智能问答
- [ ] 答案包含来源引用

### 性能验收
- [ ] 文档上传处理时间<10秒（5页PDF）
- [ ] 查询响应时间<3秒
- [ ] 支持50篇文档规模

### 代码质量
- [ ] 后端测试覆盖率>70%
- [ ] 所有API有文档
- [ ] 代码符合PEP8规范

---

## 运行和测试

### 启动后端
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 运行测试
```bash
cd backend
pytest tests/ -v --cov=app
```

### API文档
访问：http://localhost:8000/docs

---

## 下一阶段预览

完成阶段1后，可以继续：
- **阶段2**：论文专用功能（元数据提取、引用解析）
- **阶段3**：效果评估体系（RAGAS集成）
- **阶段4**：知识图谱和高级优化

---

**计划完成时间**：2-3周（约15-20个工作日）
**关键里程碑**：第1周末完成基础架构，第2周末完成核心功能，第3周测试和优化
