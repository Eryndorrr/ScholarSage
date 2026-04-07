# 🎓 ScholarSage

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**RAG 智能文档问答系统，专为学术论文和知识管理设计**

*Scholar（学者）+ Sage（智者）= 学术领域的智慧助手*

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [配置说明](#-配置说明) • [API 文档](#-api-文档)

</div>

---

## ✨ 功能特性

### 📚 知识库管理
- 多知识库分类管理，支持独立命名空间
- 知识库重命名、删除操作
- 文档上传状态实时监控

### 📄 文档处理
- 支持 **PDF**、**Markdown**、**Word** 等格式
- 智能文档解析与分块
- 重复文件检测
- 文档预览功能

### 🔍 智能检索
- **混合检索**：向量检索 + BM25 关键词检索
- **重排序**：BGE-Reranker 精排优化
- **联网搜索**：DuckDuckGo / Tavily 实时网络检索
- 来源追溯与引用展示

### 💬 对话管理
- 多会话管理，独立对话历史
- 会话标题自动生成
- Markdown 渲染支持
- 联网检索开关（会话级别）

### 📊 知识图谱
- **引用关系图谱**：可视化论文引用网络
- **主题聚类**：基于关键词的论文聚类分析
- 分层展示：内部/外部引用分类显示

### 📈 效果评估
- RAGAS 自动评估框架
- 评估历史记录
- 多维度质量指标

### 🔒 安全与部署
- 本地部署，数据安全可控
- Docker 容器化部署
- 支持多种 LLM 后端（OpenAI、Ollama 等）

---

## 🛠️ 技术栈

| 后端 | 前端 |
|------|------|
| Python 3.11+ | React 18 |
| FastAPI | TypeScript |
| SQLAlchemy | TailwindCSS |
| ChromaDB | ECharts |
| LlamaIndex | Vite |
| OpenAI API | React Query |

---

## 📦 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+
- OpenAI API Key（或兼容的 API 服务）

### 方式一：本地开发

#### 1. 克隆项目

```bash
git clone https://github.com/Eryndorrr/ScholarSage.git
cd ScholarSage
```

#### 2. 后端配置

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写 API 密钥
```

#### 3. 启动后端

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 4. 前端配置

```bash
cd ../frontend

# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env

# 启动开发服务器
npm run dev
```

#### 5. 访问应用

- 前端界面：http://localhost:5173
- API 文档：http://localhost:8000/docs

### 方式二：Docker 部署

```bash
# 在项目根目录
docker-compose up -d
```

访问：http://localhost:3000

---

## ⚙️ 配置说明

### 后端环境变量 (`.env`)

```bash
# ========== LLM 配置 ==========
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# 本地部署示例 (Ollama)
# OPENAI_API_KEY=ollama
# OPENAI_BASE_URL=http://localhost:11434/v1
# OPENAI_MODEL=llama3
# EMBEDDING_MODEL=nomic-embed-text

# ========== 数据库配置 ==========
DATABASE_URL=sqlite:///./data/knowledge.db
CHROMA_PERSIST_DIR=./data/chroma

# ========== 文档处理 ==========
CHUNK_SIZE=512
CHUNK_OVERLAP=50

# ========== 混合检索 ==========
USE_HYBRID_SEARCH=true
HYBRID_ALPHA=0.5  # 向量检索权重 (0-1)

# ========== 重排序 ==========
USE_RERANK=true
RERANK_MODEL=BAAI/bge-reranker-v2-m3
RERANK_TOP_K=20

# ========== 联网检索 ==========
WEB_SEARCH_ENABLED=true
WEB_SEARCH_PROVIDER=duckduckgo  # 可选: duckduckgo, tavily, bocha
WEB_SEARCH_MAX_RESULTS=5
# TAVILY_API_KEY=  # Tavily 需要 API Key
# BOCHA_API_KEY=  # Bocha 需要 API Key
# WEB_SEARCH_PROXY=http://127.0.0.1:7890  # 代理设置

# ========== RAGAS 评估 ==========
USE_RAGAS_EVALUATION=false
RAGAS_MODEL=gpt-4o-mini
```

### 前端环境变量 (`.env`)

```bash
VITE_API_URL=http://localhost:8000
```

---

## 📖 使用指南

### 基本流程

1. **创建知识库**：点击左侧「新建知识库」按钮
2. **上传文档**：选择知识库后上传 PDF/Markdown 文件
3. **智能问答**：在右侧对话框中提问，系统会基于文档内容回答

### 联网检索

在对话框底部点击「联网」按钮，可开启联网搜索模式：

- 🔍 同时搜索知识库和网络
- 📝 网络结果会作为补充上下文
- 🌐 支持多种搜索引擎：
  - **DuckDuckGo**（免费，无需 API Key）
  - **Tavily**（需 API Key，专为 AI 设计）
  - **Bocha 博查**（国内可用，需 API Key）

### 知识图谱

点击顶部「知识图谱」进入可视化页面：

- **引用图谱**：展示论文之间的引用关系
- **主题聚类**：按关键词自动聚类论文
- 支持筛选内部/外部引用

### 效果评估

点击顶部「效果评估」进入评估页面：

- 自动生成测试问题
- 计算 RAG 质量指标
- 查看评估历史

---

## 🔌 API 文档

启动后端后访问：
- Swagger UI：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc

### 主要接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/collections` | GET/POST | 知识库列表/创建 |
| `/api/collections/{id}` | PUT/DELETE | 更新/删除知识库 |
| `/api/collections/{id}/documents` | GET/POST | 文档列表/上传 |
| `/api/query` | POST | 智能问答 |
| `/api/sessions` | GET/POST | 会话管理 |
| `/api/papers` | GET/POST | 论文管理 |
| `/api/graph/citation/{id}` | GET | 引用图谱数据 |
| `/api/graph/clusters/{id}` | GET | 主题聚类数据 |

---

## 📁 项目结构

```
scholar-sage/
├── backend/
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心功能
│   │   │   ├── web_search/  # 联网搜索
│   │   │   ├── graph/       # 知识图谱
│   │   │   └── rag/         # RAG 引擎
│   │   ├── models/        # 数据模型
│   │   ├── schemas/       # Pydantic 模型
│   │   └── utils/         # 工具函数
│   ├── tests/             # 测试
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── services/      # API 服务
│   │   └── types/         # TypeScript 类型
│   ├── package.json
│   └── .env.example
├── docker-compose.yml
└── README.md
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [LlamaIndex](https://github.com/run-llama/llama_index) - RAG 框架
- [ChromaDB](https://www.trychroma.com/) - 向量数据库
- [FastAPI](https://fastapi.tiangolo.com/) - 后端框架
- [React](https://react.dev/) - 前端框架
- [ECharts](https://echarts.apache.org/) - 图表可视化
- [TailwindCSS](https://tailwindcss.com/) - CSS 框架

---

<div align="center">

**⭐ 如果 ScholarSage 对你有帮助，请给一个 Star！**

</div>
