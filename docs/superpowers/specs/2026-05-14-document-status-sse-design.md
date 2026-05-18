# 文档解析状态 SSE 实时推送设计

## 概述

为文档上传功能添加实时状态推送，使用 SSE (Server-Sent Events) 替代现有的轮询机制。前端可以订阅单个文档的处理进度和完成通知。

## 需求

| 项目 | 选择 |
|------|------|
| 推送内容 | 进度（0-100%）+ 完成通知 |
| 技术方案 | SSE（复用现有基础设施） |
| 连接方式 | 按文档订阅 |

## 架构

```
前端上传文档 → 后端返回 doc_id → 前端建立 SSE 连接
                                           ↓
                              SSE 端点订阅 Redis 频道
                                           ↑
                              Worker 处理时发布进度更新
```

## SSE 消息格式

### 进度更新
```json
{"status": "processing", "progress": 50, "stage": "embedding"}
```

### 解析完成
```json
{"status": "completed", "chunk_count": 42}
```

### 解析失败
```json
{"status": "failed", "error": "错误信息"}
```

## 改动文件

### 后端

| 文件 | 改动 |
|------|------|
| `app/api/documents.py` | 新增 `GET /{doc_id}/status/stream` SSE 端点 |
| `app/worker.py` | 在处理过程中发布进度到 Redis |
| `app/core/rag/document_processor.py` | 添加进度回调参数 |

### 前端

| 文件 | 改动 |
|------|------|
| `src/hooks/useDocumentStatus.ts` | 新建 SSE 订阅 hook |
| `src/components/DocumentList.tsx` | 使用新 hook 替代轮询 |
| `src/App.tsx` | 移除轮询逻辑 |

## 实现细节

### 1. 后端 SSE 端点

```python
# app/api/documents.py

from fastapi import Response
from fastapi.responses import StreamingResponse
import json

@router.get("/{doc_id}/status/stream")
async def document_status_stream(
    doc_id: str,
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    SSE 流式返回文档处理状态

    消息格式:
    - processing: {"status": "processing", "progress": 50, "stage": "embedding"}
    - completed: {"status": "completed", "chunk_count": 42}
    - failed: {"status": "failed", "error": "..."}
    """

    # 1. 验证 ownership
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.collection_id == collection_id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    async def event_generator():
        redis = get_redis_pool()
        channel = f"doc_status:{doc_id}"

        # 检查当前状态，如果已完成直接返回
        if document.status in ["completed", "failed"]:
            yield f"data: {json.dumps(build_status_message(document))}\n\n"
            return

        # 订阅 Redis 频道
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    yield f"data: {data.decode()}\n\n"

                    # 解析检查是否完成
                    parsed = json.loads(data)
                    if parsed.get("status") in ["completed", "failed"]:
                        break
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

def build_status_message(doc: Document) -> dict:
    """构建状态消息"""
    if doc.status == "completed":
        return {"status": "completed", "chunk_count": doc.chunk_count}
    elif doc.status == "failed":
        return {"status": "failed", "error": doc.error_message}
    else:
        return {"status": doc.status, "progress": doc.progress}
```

### 2. Worker 进度发布

```python
# app/worker.py

import json
from redis import asyncio as aioredis

async def process_document_task(ctx, document_id: str, collection_id: str, file_path: str):
    """异步处理文档任务"""

    db = next(get_db())
    redis = ctx.get("redis") or get_redis_pool()

    async def publish_status(status: str, progress: int = None, stage: str = None, **extra):
        """发布状态到 Redis"""
        message = {"status": status}
        if progress is not None:
            message["progress"] = progress
        if stage:
            message["stage"] = stage
        message.update(extra)

        await redis.publish(f"doc_status:{document_id}", json.dumps(message))

    try:
        # 更新状态：开始处理
        doc = db.query(Document).filter(Document.id == document_id).first()
        doc.status = "processing"
        doc.progress = 0
        db.commit()
        await publish_status("processing", progress=0, stage="initializing")

        # 解析文档（带进度回调）
        async def on_progress(progress: int, stage: str):
            doc.progress = progress
            db.commit()
            await publish_status("processing", progress=progress, stage=stage)

        processor = DocumentProcessor(collection_id, db)
        chunk_count = await processor.process(file_path, on_progress=on_progress)

        # 更新状态：完成
        doc.status = "completed"
        doc.progress = 100
        doc.chunk_count = chunk_count
        db.commit()
        await publish_status("completed", chunk_count=chunk_count)

    except Exception as e:
        # 更新状态：失败
        doc = db.query(Document).filter(Document.id == document_id).first()
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()
        await publish_status("failed", error=str(e))
```

### 3. DocumentProcessor 进度回调

```python
# app/core/rag/document_processor.py

class DocumentProcessor:
    async def process(
        self,
        file_path: str,
        on_progress: Callable[[int, str], Awaitable[None]] = None
    ) -> int:
        """处理文档，支持进度回调"""

        # 阶段映射
        stages = {
            "parsing": (0, 25),
            "chunking": (25, 35),
            "embedding": (35, 85),
            "storing": (85, 100)
        }

        if on_progress:
            await on_progress(0, "parsing")

        # 解析文档
        text = self.parser.parse(file_path)
        if on_progress:
            await on_progress(25, "chunking")

        # 切分
        chunks = self.chunker.chunk(text)
        if on_progress:
            await on_progress(35, "embedding")

        # 向量化
        embeddings = self.embedder.embed_batch(chunks)
        if on_progress:
            await on_progress(85, "storing")

        # 存储
        self.vector_store.add(chunks, embeddings)
        if on_progress:
            await on_progress(100, "completed")

        return len(chunks)
```

### 4. 前端 SSE Hook

```typescript
// src/hooks/useDocumentStatus.ts

import { useEffect, useState, useCallback } from 'react'

interface DocStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  stage?: string
  chunk_count?: number
  error?: string
}

export function useDocumentStatus(docId: string | null) {
  const [status, setStatus] = useState<DocStatus | null>(null)

  useEffect(() => {
    if (!docId) return

    const eventSource = new EventSource(
      `${API_BASE_URL}/api/documents/${docId}/status/stream`,
      { withCredentials: true }
    )

    eventSource.onmessage = (e) => {
      const data: DocStatus = JSON.parse(e.data)
      setStatus(data)

      // 完成或失败时关闭连接
      if (data.status === 'completed' || data.status === 'failed') {
        eventSource.close()
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [docId])

  return status
}
```

### 5. DocumentList 组件改造

```typescript
// src/components/DocumentList.tsx

// 上传后立即订阅
const [watchingDocId, setWatchingDocId] = useState<string | null>(null)
const liveStatus = useDocumentStatus(watchingDocId)

// 处理上传完成
const handleUploadComplete = (doc: Document) => {
  setWatchingDocId(doc.id)  // 开始监听新上传的文档
  fetchDocuments()  // 刷新列表
}

// 合并实时状态到文档列表
const documentsWithStatus = documents.map(doc => {
  if (doc.id === watchingDocId && liveStatus) {
    return { ...doc, ...liveStatus }
  }
  return doc
})

// 当状态变为完成时停止监听
useEffect(() => {
  if (liveStatus?.status === 'completed' || liveStatus?.status === 'failed') {
    fetchDocuments()  // 刷新完整数据
    setWatchingDocId(null)
  }
}, [liveStatus?.status])
```

### 6. 移除轮询逻辑

```typescript
// src/App.tsx

// 删除以下代码：
// - pollingRef
// - 检查 processing 文档的 useEffect
// - setInterval 轮询逻辑
```

## 错误处理

1. **SSE 连接断开**: 前端自动重连，或回退到轮询
2. **Redis 连接失败**: Worker 降级为仅更新数据库，前端通过轮询获取
3. **文档不存在**: SSE 端点返回 404

## 兼容性

- SSE 支持所有现代浏览器
- 移动端浏览器完全支持
- 如需支持 IE，可使用 polyfill 或回退到轮询

## 性能考虑

- 每个上传文档一个 SSE 连接，处理完成后自动关闭
- Redis Pub/Sub 轻量级，支持多实例部署
- 进度更新频率控制在每个阶段一次，避免过度推送
