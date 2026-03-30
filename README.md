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

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # 填写API密钥
uvicorn app.main:app --reload
```

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

### Docker部署

```bash
docker-compose up -d
```

## 使用说明

1. 创建知识库
2. 上传文档（PDF/Markdown）
3. 开始智能问答

## API文档

访问 http://localhost:8000/docs 查看完整API文档