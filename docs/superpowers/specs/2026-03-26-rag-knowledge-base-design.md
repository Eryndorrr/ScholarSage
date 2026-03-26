# 企业级RAG知识库系统 - 设计文档

**项目名称**：Enterprise RAG Knowledge Base System
**设计日期**：2026-03-26
**版本**：1.0
**开发模式**：渐进式开发（4个阶段，6-10周）

---

## 1. 项目概述

### 1.1 项目目标

构建一个基于RAG（Retrieval-Augmented Generation）技术的企业级知识库系统，专门优化论文和学术文档的管理与问答场景，具备以下核心能力：

- **智能文档问答**：上传文档后，可以基于文档内容进行智能问答
- **论文专用功能**：支持论文元数据提取、引用解析、BibTeX自动生成
- **知识库分类管理**：按研究主题组织文档，独立管理不同领域的知识
- **效果评估体系**：集成RAGAS评估框架，量化评估检索和生成质量
- **知识图谱可视化**：展示论文间的引用关系和主题聚类

### 1.2 目标用户

- **主要用户**：学生、研究者（用于论文管理和学习）
- **面试展示**：求职者展示RAG技术能力
- **使用场景**：本地单机使用，支持50-200篇文档规模

### 1.3 核心价值

1. **快速原型**：2-3周即可演示基础功能
2. **技术深度**：涵盖RAG核心技术栈，面试价值高
3. **实用性强**：可以实际用于论文管理和知识整理
4. **可扩展性**：模块化设计，便于后续功能扩展

---

## 2. 系统架构

### 2.1 整体架构

采用经典的三层架构设计：

```
┌─────────────────────────────────────────────────────────┐
│                      前端层 (Frontend)                   │
│         React 18 + TypeScript + Tailwind CSS            │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────┴───────────────────────────────────┐
│                    API层 (Backend)                       │
│            FastAPI + LlamaIndex + Pydantic               │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│                    数据层 (Data)                         │
│      Chroma (向量库) + SQLite (元数据) + Redis (缓存)    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 技术栈选型

#### 前端技术栈
- **框架**：React 18 + TypeScript
- **UI库**：Tailwind CSS + Shadcn/UI（或Ant Design）
- **状态管理**：React Query + Context API
- **图表库**：ECharts / D3.js（知识图谱可视化）
- **构建工具**：Vite

#### 后端技术栈
- **Web框架**：FastAPI
- **RAG框架**：LlamaIndex
- **数据验证**：Pydantic
- **任务队列**：Celery（可选，用于后台处理）
- **API文档**：自动生成（FastAPI内置）

#### 数据存储
- **向量数据库**：Chroma（本地存储，无需额外安装）
- **关系数据库**：SQLite（轻量级，适合单机）
- **缓存**：Redis（可选，用于查询缓存）

#### AI模型
- **LLM**：OpenAI GPT-3.5/4 或 Claude API
- **Embedding模型**：OpenAI text-embedding-ada-002 或 BGE-base-zh
- **重排序模型**：BGE-reranker-base（可选）

#### 部署方案
- **容器化**：Docker + Docker Compose
- **部署方式**：本地单机部署

### 2.3 数据流程

```
1. 用户上传文档
   ↓
2. 文档解析和预处理
   - PDF解析（PyPDF2 / pdfplumber）
   - 论文专用解析（提取标题、作者、摘要）
   ↓
3. 文档切分（Chunking）
   - 按段落/章节切分
   - 保留元数据（页码、章节）
   ↓
4. 向量化（Embedding）
   - 使用Embedding模型生成向量
   ↓
5. 存储到向量数据库
   - Chroma存储向量和元数据
   ↓
6. 用户提问
   ↓
7. 语义检索
   - 向量相似度检索
   - 返回Top-K相关片段
   ↓
8. LLM生成答案
   - 基于检索结果生成答案
   - 标注来源引用
   ↓
9. 返回答案+来源
```

---

## 3. 项目目录结构

```
enterprise-rag-knowledge-base/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── api/               # API路由
│   │   │   ├── documents.py   # 文档管理API
│   │   │   ├── qa.py          # 问答API
│   │   │   ├── papers.py      # 论文专用API
│   │   │   ├── collections.py # 知识库管理API
│   │   │   └── evaluation.py  # 评估API
│   │   ├── core/              # 核心功能
│   │   │   ├── rag/           # RAG引擎
│   │   │   │   ├── document_processor.py
│   │   │   │   ├── embeddings.py
│   │   │   │   ├── retriever.py
│   │   │   │   └── generator.py
│   │   │   ├── parsers/       # 文档解析器
│   │   │   │   ├── pdf_parser.py
│   │   │   │   ├── paper_parser.py
│   │   │   │   └── markdown_parser.py
│   │   │   └── graph/         # 知识图谱
│   │   │       ├── citation_graph.py
│   │   │       └── topic_cluster.py
│   │   ├── models/            # 数据模型
│   │   │   ├── document.py
│   │   │   ├── collection.py
│   │   │   ├── paper.py
│   │   │   └── citation.py
│   │   ├── schemas/           # Pydantic模式
│   │   └── utils/             # 工具函数
│   ├── requirements.txt
│   └── main.py
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/        # React组件
│   │   │   ├── DocumentUpload/
│   │   │   ├── QAInterface/
│   │   │   ├── PaperManager/
│   │   │   ├── CollectionManager/
│   │   │   ├── KnowledgeGraph/
│   │   │   └── Evaluation/
│   │   ├── hooks/             # 自定义Hooks
│   │   ├── services/          # API服务
│   │   ├── types/             # TypeScript类型
│   │   └── utils/             # 工具函数
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                       # 文档
│   ├── api/                   # API文档
│   ├── design/                # 设计文档
│   └── deployment/            # 部署文档
│
├── tests/                      # 测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docker-compose.yml          # Docker编排
├── .env.example               # 环境变量模板
└── README.md
```

---

## 4. 渐进式开发计划

### 4.1 阶段1：核心RAG功能（2-3周）

**目标**：实现基本的文档问答功能

**功能清单**：
- ✅ 文档上传（PDF/Word/Markdown）
- ✅ 文档解析和切分
- ✅ 向量化存储到Chroma
- ✅ 基础问答界面
- ✅ 来源追溯显示
- ✅ 知识库基础管理（创建/删除/列表）

**技术要点**：
- LlamaIndex文档处理流程
- Chroma向量数据库集成
- FastAPI基础API搭建
- React基础组件开发

**演示成果**：
- 上传一篇论文
- 提问并得到带引用的答案
- 展示来源文档片段

**交付物**：
- 可运行的后端服务
- 基础前端界面
- Docker部署配置

---

### 4.2 阶段2：论文专用功能（1-2周）

**目标**：增强论文场景支持

**功能清单**：
- ✅ 论文元数据提取（标题、作者、摘要、关键词）
- ✅ 引用关系解析
- ✅ BibTeX自动生成
- ✅ 论文管理界面
- ✅ 按知识库分类管理

**技术要点**：
- PDF论文结构解析
- 正则表达式提取元数据
- 引用格式标准化
- 前端论文列表组件

**演示成果**：
- 上传10篇论文
- 展示论文元数据
- 自动生成BibTeX引用
- 展示知识库分类

**交付物**：
- 论文解析模块
- 论文管理API
- 论文管理UI组件

---

### 4.3 阶段3：效果评估体系（1-2周）

**目标**：建立专业的评估体系

**功能清单**：
- ✅ RAGAS评估框架集成
- ✅ 性能指标监控（检索准确率、响应时间）
- ✅ 评估报告生成
- ✅ 参数对比工具（chunk_size、top_k等）
- ✅ 评估历史记录

**技术要点**：
- RAGAS评估指标计算
- 数据库存储评估结果
- 可视化图表展示
- A/B测试框架

**评估指标**：
- **Faithfulness**：答案忠实度（是否基于检索内容）
- **Answer Relevancy**：答案相关性
- **Context Precision**：上下文精确度
- **Context Recall**：上下文召回率

**演示成果**：
- 展示不同chunk_size的评估对比
- 生成评估报告（PDF/图表）
- 展示性能趋势

**交付物**：
- 评估模块
- 评估API
- 评估报告UI

---

### 4.4 阶段4：知识图谱和优化（2-3周）

**目标**：高级可视化和性能优化

**功能清单**：
- ✅ 引用关系图谱可视化
- ✅ 主题聚类展示
- ✅ 知识网络探索
- ✅ 混合检索（BM25 + 向量）
- ✅ 重排序优化（BGE-reranker）
- ✅ 查询缓存（Redis）

**技术要点**：
- 网络图可视化（D3.js / ECharts）
- 图算法（PageRank、社区检测）
- BM25检索集成
- 重排序模型部署
- Redis缓存策略

**演示成果**：
- 可视化展示论文引用网络
- 展示主题聚类结果
- 对比混合检索效果提升
- 展示响应时间优化

**交付物**：
- 知识图谱模块
- 混合检索实现
- 性能优化配置
- 完整系统文档

---

## 5. 数据模型设计

### 5.1 核心数据模型

#### Collection（知识库）
```python
class Collection:
    id: UUID                    # 知识库ID
    name: str                   # 知识库名称
    description: str            # 描述
    color: str                  # 主题颜色（#1976d2）
    document_count: int         # 文档数量
    created_at: datetime        # 创建时间
    updated_at: datetime        # 更新时间
```

#### Document（文档）
```python
class Document:
    id: UUID                    # 文档ID
    collection_id: UUID         # 所属知识库ID
    title: str                  # 文档标题
    file_path: str              # 文件路径
    file_type: FileType         # 文件类型（PDF/WORD/MD）
    file_size: int              # 文件大小（字节）
    upload_time: datetime       # 上传时间
    metadata: JSON              # 扩展元数据
    chunks: List[Chunk]         # 文档切片
```

#### Chunk（文档切片）
```python
class Chunk:
    id: UUID                    # 切片ID
    document_id: UUID           # 所属文档ID
    content: str                # 切片内容
    embedding: List[float]      # 向量表示
    metadata: JSON              # 元数据（页码、章节等）
    page_num: int               # 页码
    position: int               # 位置序号
```

#### Paper（论文专用）
```python
class Paper:
    document_id: UUID           # 关联文档ID
    authors: List[str]          # 作者列表
    abstract: str               # 摘要
    keywords: List[str]         # 关键词
    publication_date: date      # 发表日期
    doi: str                    # DOI
    references: List[Citation]  # 引用列表
```

#### Citation（引用关系）
```python
class Citation:
    id: UUID                    # 引用ID
    paper_id: UUID              # 所属论文ID
    cited_paper_title: str      # 被引用论文标题
    cited_authors: List[str]    # 被引用作者
    bibtex: str                 # BibTeX格式
    location: str               # 引用位置（页码、段落）
```

#### QueryHistory（查询历史）
```python
class QueryHistory:
    id: UUID                    # 查询ID
    question: str               # 问题
    answer: str                 # 答案
    collection_id: UUID         # 查询的知识库
    sources: List[Source]       # 参考来源
    confidence: float           # 置信度
    query_time: datetime        # 查询时间
    response_time: float        # 响应时间（秒）
```

#### Evaluation（评估记录）
```python
class Evaluation:
    id: UUID                    # 评估ID
    collection_id: UUID         # 评估的知识库
    metrics: JSON               # 评估指标
    parameters: JSON            # 评估参数
    created_at: datetime        # 创建时间
```

### 5.2 数据库关系图

```
Collection (1) ──────< (N) Document
                            │
                            └──────< (N) Chunk

Document (1) ──────< (1) Paper
                            │
                            └──────< (N) Citation

Collection (1) ──────< (N) QueryHistory
Collection (1) ──────< (N) Evaluation
```

---

## 6. API接口设计

### 6.1 知识库管理 API

#### 创建知识库
```
POST /api/collections
Request:
{
  "name": "RAG技术研究",
  "description": "关于RAG技术的相关论文",
  "color": "#1976d2"
}

Response:
{
  "id": "uuid",
  "name": "RAG技术研究",
  "description": "关于RAG技术的相关论文",
  "color": "#1976d2",
  "document_count": 0,
  "created_at": "2024-03-15T10:30:00Z"
}
```

#### 获取知识库列表
```
GET /api/collections

Response:
{
  "collections": [
    {
      "id": "uuid",
      "name": "RAG技术研究",
      "document_count": 15,
      "updated_at": "2024-03-15T10:30:00Z"
    }
  ]
}
```

#### 获取知识库统计
```
GET /api/collections/{id}/stats

Response:
{
  "document_count": 15,
  "total_chunks": 234,
  "total_size_mb": 45.2,
  "query_count": 234,
  "avg_response_time": 2.3,
  "last_query_time": "2024-03-15T10:30:00Z"
}
```

### 6.2 文档管理 API

#### 上传文档
```
POST /api/collections/{collection_id}/documents
Content-Type: multipart/form-data

Request:
- file: (binary)
- metadata: {"title": "RAG技术综述"}

Response:
{
  "id": "uuid",
  "title": "RAG技术综述",
  "file_type": "pdf",
  "status": "processing",
  "message": "文档正在处理中"
}
```

#### 获取文档列表
```
GET /api/collections/{collection_id}/documents?filter={type}

Response:
{
  "documents": [
    {
      "id": "uuid",
      "title": "RAG技术综述.pdf",
      "file_type": "pdf",
      "file_size": 2345678,
      "upload_time": "2024-03-15T10:30:00Z",
      "chunk_count": 23
    }
  ],
  "total": 15
}
```

#### 删除文档
```
DELETE /api/documents/{id}

Response:
{
  "success": true,
  "message": "文档已删除"
}
```

### 6.3 RAG问答 API

#### 提交查询
```
POST /api/query

Request:
{
  "question": "RAG和微调的主要区别是什么？",
  "collection_id": "uuid",        // 可选：限定知识库
  "search_all": false,            // 是否搜索全部知识库
  "top_k": 3,
  "include_sources": true
}

Response:
{
  "answer": "根据论文[1][2]，RAG和微调的主要区别有...",
  "sources": [
    {
      "document_id": "uuid",
      "title": "RAG技术综述",
      "page": 3,
      "snippet": "...",
      "relevance_score": 0.92,
      "collection_name": "RAG技术研究"
    }
  ],
  "confidence": 0.85,
  "response_time": 2.3
}
```

#### 流式查询（SSE）
```
POST /api/query/stream

Request: 同上

Response: (Server-Sent Events)
data: {"type": "retrieval", "sources": [...]}
data: {"type": "generation", "text": "根据..."}
data: {"type": "complete", "answer": "...", "sources": [...]}
```

#### 查询历史
```
GET /api/query/history?collection_id={id}&limit=10

Response:
{
  "history": [
    {
      "id": "uuid",
      "question": "RAG和微调的区别？",
      "answer": "...",
      "query_time": "2024-03-15T10:30:00Z"
    }
  ]
}
```

### 6.4 论文专用 API

#### 解析论文
```
POST /api/papers/parse

Request:
{
  "document_id": "uuid"
}

Response:
{
  "paper_id": "uuid",
  "title": "Retrieval-Augmented Generation...",
  "authors": ["Lewis, Patrick", "Perez, Ethan"],
  "abstract": "...",
  "keywords": ["RAG", "retrieval", "generation"],
  "doi": "10.1234/xxx"
}
```

#### 获取引用关系
```
GET /api/papers/{paper_id}/citations

Response:
{
  "citations": [
    {
      "id": "uuid",
      "cited_paper_title": "BERT: Pre-training...",
      "cited_authors": ["Devlin, Jacob"],
      "location": "Page 2, Paragraph 3"
    }
  ]
}
```

#### 生成BibTeX
```
POST /api/papers/generate-bibtex

Request:
{
  "paper_ids": ["uuid1", "uuid2"]
}

Response:
{
  "bibtex": [
    "@inproceedings{lewis2020rag,\n  title={...},\n  author={...}\n}",
    "@article{devlin2019bert,\n  title={...},\n  author={...}\n}"
  ]
}
```

#### 引用图谱
```
GET /api/papers/citation-graph?collection_id={id}

Response:
{
  "nodes": [
    {"id": "uuid", "title": "RAG论文", "authors": ["Lewis"]}
  ],
  "edges": [
    {"source": "uuid1", "target": "uuid2", "type": "cites"}
  ]
}
```

### 6.5 评估 API

#### 运行评估
```
POST /api/evaluation/run

Request:
{
  "collection_id": "uuid",
  "sample_size": 100,           // 评估样本数量
  "parameters": {
    "chunk_size": 512,
    "top_k": 3
  }
}

Response:
{
  "evaluation_id": "uuid",
  "status": "running",
  "message": "评估任务已启动"
}
```

#### 获取评估结果
```
GET /api/evaluation/{evaluation_id}

Response:
{
  "id": "uuid",
  "status": "completed",
  "metrics": {
    "faithfulness": 0.87,
    "answer_relevancy": 0.82,
    "context_precision": 0.79,
    "context_recall": 0.85
  },
  "parameters": {
    "chunk_size": 512,
    "top_k": 3
  },
  "created_at": "2024-03-15T10:30:00Z"
}
```

#### 评估报告列表
```
GET /api/evaluation/reports?collection_id={id}

Response:
{
  "reports": [
    {
      "id": "uuid",
      "metrics": {...},
      "created_at": "2024-03-15T10:30:00Z"
    }
  ]
}
```

---

## 7. UI界面设计

### 7.1 主界面布局

采用**三栏式布局**：

```
┌─────────────────────────────────────────────────────────┐
│  📚 RAG知识库系统  [知识库] [问答] [论文] [评估]        │
├──────────┬──────────────┬────────────────────────────────┤
│          │              │                                │
│ 知识库   │  文档列表    │      智能问答界面              │
│ 列表     │              │                                │
│          │              │  ┌─────────────────────────┐  │
│ 🔬 RAG   │  📄 文档1    │  │ 问答历史               │  │
│ 🔬 LLM   │  📄 文档2    │  │                        │  │
│ 🔬 向量  │  📄 文档3    │  │ 你: RAG是什么？        │  │
│ 🔬 图谱  │  [上传]      │  │ AI: RAG是...           │  │
│          │              │  └─────────────────────────┘  │
│ [新建]   │              │                                │
│          │              │  [输入框] [发送]              │
│          │              │                                │
│          │              │  ┌─────────────────────────┐  │
│          │              │  │ 参考来源               │  │
│          │              │  │ 📄 文档1 第3页 92%    │  │
│          │              │  │ 📄 文档2 第7页 87%    │  │
│          │              │  └─────────────────────────┘  │
└──────────┴──────────────┴────────────────────────────────┘
```

### 7.2 知识库管理界面

**功能**：
- 知识库卡片展示（名称、描述、文档数量、更新时间）
- 颜色标识（每个知识库独立颜色）
- 创建/删除/重命名操作
- 搜索和筛选

**交互**：
- 点击知识库进入文档列表
- 悬停显示详细统计信息
- 右键菜单（重命名、删除、导出）

### 7.3 文档管理界面

**功能**：
- 文档列表（标题、类型、大小、上传时间）
- 批量上传支持
- 文档预览（PDF查看器）
- 删除和重新上传

**交互**：
- 拖拽上传文件
- 点击文档查看详情
- 标签页切换（全部/论文/笔记）

### 7.4 智能问答界面

**功能**：
- 聊天式问答界面
- 实时流式输出
- 来源引用标注
- 检索范围选择（当前库/全部库）
- 查询历史记录

**交互**：
- Enter发送消息
- 点击来源跳转到文档位置
- 复制答案和引用
- 点赞/点踩反馈

### 7.5 论文管理界面

**功能**：
- 论文列表（标题、作者、发表年份）
- 论文详情（摘要、关键词、DOI）
- 引用关系可视化
- BibTeX导出
- 按作者/关键词筛选

### 7.6 知识图谱界面

**功能**：
- 引用网络图（节点=论文，边=引用关系）
- 主题聚类可视化
- 交互式探索（点击节点查看详情）
- 图谱导出（PNG/PDF）

**可视化工具**：
- D3.js / ECharts（网络图）
- 力导向布局算法

### 7.7 效果评估界面

**功能**：
- 评估指标仪表盘（Faithfulness、Relevancy等）
- 参数对比图表（折线图、柱状图）
- 性能趋势分析
- 导出评估报告（PDF）

---

## 8. 技术实现要点

### 8.1 文档处理流程

```python
# 1. 文档上传和解析
def process_document(file_path, collection_id):
    # 解析文档
    if file_type == "pdf":
        parser = PDFParser(file_path)
    elif file_type == "md":
        parser = MarkdownParser(file_path)

    # 提取文本
    text = parser.extract_text()

    # 切分文档
    chunks = split_text(text, chunk_size=512, overlap=50)

    # 向量化
    embeddings = embedding_model.encode(chunks)

    # 存储到向量库
    vector_store.add(chunks, embeddings, metadata)

    return document_id
```

### 8.2 检索和生成

```python
# 2. RAG查询流程
def rag_query(question, collection_id, top_k=3):
    # 向量化问题
    question_embedding = embedding_model.encode(question)

    # 检索相关片段
    results = vector_store.search(
        question_embedding,
        collection_id=collection_id,
        top_k=top_k
    )

    # 构建提示词
    context = build_context(results)
    prompt = f"基于以下内容回答问题：\n{context}\n\n问题：{question}"

    # LLM生成答案
    answer = llm.generate(prompt)

    # 返回答案和来源
    return {
        "answer": answer,
        "sources": results,
        "confidence": calculate_confidence(results)
    }
```

### 8.3 论文解析

```python
# 3. 论文元数据提取
def parse_paper_metadata(pdf_path):
    # 提取标题（通常是第一页大字体）
    title = extract_title(pdf_path)

    # 提取作者（标题下方）
    authors = extract_authors(pdf_path)

    # 提取摘要（"Abstract"章节）
    abstract = extract_abstract(pdf_path)

    # 提取引用（"References"章节）
    references = extract_references(pdf_path)

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "references": references
    }
```

### 8.4 知识图谱构建

```python
# 4. 引用关系图构建
def build_citation_graph(papers):
    import networkx as nx

    G = nx.DiGraph()

    for paper in papers:
        # 添加节点
        G.add_node(paper.id, title=paper.title)

        # 添加引用边
        for citation in paper.references:
            cited_paper = find_paper_by_title(citation.title)
            if cited_paper:
                G.add_edge(paper.id, cited_paper.id)

    # 计算PageRank
    pagerank = nx.pagerank(G)

    # 社区检测（主题聚类）
    communities = detect_communities(G)

    return G, pagerank, communities
```

### 8.5 评估流程

```python
# 5. RAGAS评估
def evaluate_rag_system(collection_id, sample_questions):
    from ragas import evaluate
    from ragas.metrics import faithfulness, answer_relevancy

    results = []

    for question in sample_questions:
        # 获取答案
        answer = rag_query(question, collection_id)

        # 计算指标
        faithfulness_score = faithfulness.compute(
            question=question,
            answer=answer.text,
            contexts=answer.sources
        )

        relevancy_score = answer_relevancy.compute(
            question=question,
            answer=answer.text
        )

        results.append({
            "faithfulness": faithfulness_score,
            "relevancy": relevancy_score
        })

    # 计算平均值
    avg_metrics = calculate_average(results)

    return avg_metrics
```

---

## 9. 部署方案

### 9.1 Docker Compose配置

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_URL=sqlite:///data/knowledge.db
      - CHROMA_PERSIST_DIR=/data/chroma
    volumes:
      - ./data:/data
    depends_on:
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### 9.2 环境变量配置

```bash
# .env.example
OPENAI_API_KEY=sk-xxx
DATABASE_URL=sqlite:///data/knowledge.db
CHROMA_PERSIST_DIR=/data/chroma
REDIS_URL=redis://localhost:6379
EMBEDDING_MODEL=text-embedding-ada-002
LLM_MODEL=gpt-3.5-turbo
```

---

## 10. 测试策略

### 10.1 单元测试

- 文档解析器测试
- 向量化模块测试
- 检索模块测试
- API端点测试

### 10.2 集成测试

- 端到端问答流程测试
- 文档上传和处理测试
- 知识库管理测试

### 10.3 性能测试

- 检索响应时间（目标<3秒）
- 并发查询测试（10用户）
- 大规模文档测试（200篇）

---

## 11. 后续优化方向

### 11.1 性能优化
- 混合检索（BM25 + 向量）
- 查询缓存（Redis）
- 增量索引更新
- 批量向量计算

### 11.2 功能扩展
- 多模态支持（图片、表格）
- 协作功能（多用户）
- API开放（第三方集成）
- 移动端适配

### 11.3 算法优化
- 查询改写（Query Rewriting）
- 自适应检索（Adaptive Retrieval）
- 多轮对话支持
- 答案验证和纠错

---

## 12. 项目里程碑

| 阶段 | 时间 | 交付物 | 可演示功能 |
|------|------|--------|-----------|
| **阶段1** | 第2-3周 | 核心RAG系统 | 基础问答、来源追溯 |
| **阶段2** | 第4-5周 | 论文功能 | 论文管理、引用生成 |
| **阶段3** | 第6-7周 | 评估体系 | 评估报告、参数对比 |
| **阶段4** | 第8-10周 | 知识图谱 | 引用网络、主题聚类 |

---

## 13. 成功标准

### 13.1 功能完整性
- ✅ 所有阶段功能按时交付
- ✅ 核心功能测试覆盖率>80%
- ✅ 无严重bug

### 13.2 性能指标
- ✅ 检索响应时间<3秒
- ✅ 检索准确率>80%（人工评估）
- ✅ 支持50-200篇文档规模

### 13.3 面试展示
- ✅ 可现场演示完整流程
- ✅ 能讲解技术选型原因
- ✅ 能回答常见面试问题

---

## 14. 风险和应对

### 14.1 技术风险
- **风险**：API成本过高
- **应对**：使用本地模型备选方案

### 14.2 时间风险
- **风险**：某个阶段延期
- **应对**：优先完成核心功能，高级功能可裁剪

### 14.3 复杂度风险
- **风险**：功能过于复杂
- **应对**：严格遵循YAGNI原则，只做必要功能

---

**文档版本历史**：
- v1.0 (2026-03-26) - 初始设计文档
