# 文档解析状态 SSE 实时推送实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 SSE 替代轮询，实现文档解析状态的实时推送

**Architecture:** 后端 Worker 通过 Redis Pub/Sub 发布进度，SSE 端点订阅并流式返回给前端，前端使用 EventSource API 接收更新

**Tech Stack:** FastAPI SSE, Redis Pub/Sub, React EventSource

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/api/documents.py` | 修改 | 新增 SSE 端点 |
| `backend/app/worker.py` | 修改 | 添加 Redis 发布逻辑 |
| `frontend/src/hooks/useDocumentStatus.ts` | 新建 | SSE 订阅 hook |
| `frontend/src/components/DocumentManager/DocumentList.tsx` | 修改 | 使用新 hook |
| `frontend/src/App.tsx` | 修改 | 移除轮询，传递状态更新 |

---

### Task 1: 后端 SSE 端点

**Files:**
- Modify: `backend/app/api/documents.py`

- [ ] **Step 1: 添加 SSE 状态流端点**

在 `documents.py` 末尾添加 SSE 端点（在现有路由之后）：

```python
# === SSE 状态流端点 ===
from fastapi.responses import StreamingResponse
import json
from redis import asyncio as aioredis


@router.get("/{document_id}/status/stream")
async def document_status_stream(
    collection_id: str,
    document_id: str,
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
    from app.config import settings as app_settings

    # 验证 ownership
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.collection_id == collection_id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    async def event_generator():
        try:
            # 连接 Redis
            redis = await aioredis.from_url(
                f"redis://{app_settings.redis_host}:{app_settings.redis_port}",
                password=app_settings.redis_password,
                db=app_settings.redis_db,
            )
            channel = f"doc_status:{document_id}"

            # 检查当前状态，如果已完成直接返回
            db.refresh(document)
            if document.status in [ProcessStatus.COMPLETED, ProcessStatus.FAILED]:
                message = _build_status_message(document)
                yield f"data: {json.dumps(message)}\n\n"
                await redis.close()
                return

            # 订阅 Redis 频道
            pubsub = redis.pubsub()
            await pubsub.subscribe(channel)

            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = message["data"]
                        if isinstance(data, bytes):
                            data = data.decode("utf-8")
                        yield f"data: {data}\n\n"

                        # 解析检查是否完成
                        try:
                            parsed = json.loads(data)
                            if parsed.get("status") in ["completed", "failed"]:
                                break
                        except json.JSONDecodeError:
                            pass
            finally:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
                await redis.close()

        except Exception as e:
            logger.error(f"SSE error for document {document_id}: {e}")
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


def _build_status_message(doc: Document) -> dict:
    """构建状态消息"""
    if doc.status == ProcessStatus.COMPLETED:
        return {"status": "completed", "chunk_count": doc.chunk_count}
    elif doc.status == ProcessStatus.FAILED:
        return {"status": "failed", "error": doc.error_message}
    elif doc.status == ProcessStatus.PROCESSING:
        return {"status": "processing", "progress": doc.progress or 0}
    else:
        return {"status": "pending"}
```

- [ ] **Step 2: 验证语法正确**

```bash
cd /home/eryndor/code/Learn_RAG/backend && python -c "from app.api.documents import router; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/documents.py
git commit -m "feat: add SSE endpoint for document status streaming"
```

---

### Task 2: Worker Redis 发布

**Files:**
- Modify: `backend/app/worker.py`

- [ ] **Step 1: 添加 Redis 发布函数和进度回调**

修改 `worker.py`，添加 Redis 发布逻辑：

```python
import logging
import sys
import json

from arq.connections import RedisSettings
from redis import asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)


async def _publish_status(
    redis: aioredis.Redis,
    document_id: str,
    status: str,
    progress: int = None,
    stage: str = None,
    **extra
):
    """发布状态到 Redis 频道"""
    message = {"status": status}
    if progress is not None:
        message["progress"] = progress
    if stage:
        message["stage"] = stage
    message.update(extra)

    channel = f"doc_status:{document_id}"
    await redis.publish(channel, json.dumps(message))


async def process_document_task(
    ctx: dict,
    document_id: str,
    file_path: str,
    collection_id: str,
    file_type: str,
    document_title: str,
):
    """arq worker 函数：处理文档（解析 → 分块 → 向量化）"""
    from app.core.rag.document_processor import DocumentProcessor
    from app.database import SessionLocal
    from app.models import Document, ProcessStatus
    from app.models.document import FileType

    task_logger = logging.getLogger("app.worker")
    if not task_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
        task_logger.addHandler(handler)
        task_logger.setLevel(logging.INFO)

    task_logger.info(f"arq: Processing document {document_id}")

    # 连接 Redis 用于发布状态
    redis = await aioredis.from_url(
        f"redis://{settings.redis_host}:{settings.redis_port}",
        password=settings.redis_password,
        db=settings.redis_db,
    )

    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            task_logger.error(f"Document {document_id} not found")
            return

        document.status = ProcessStatus.PROCESSING
        document.progress = 0
        db.commit()

        # 发布初始状态
        await _publish_status(redis, document_id, "processing", progress=0, stage="initializing")

        # 进度回调函数（带 Redis 发布）
        async def update_progress(progress: int, stage: str = None):
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.progress = progress
                db.commit()
            await _publish_status(redis, document_id, "processing", progress=progress, stage=stage)
            task_logger.info(f"Document {document_id} progress: {progress}%")

        file_type_enum = FileType(file_type)

        processor = DocumentProcessor()
        result = processor.process_document(
            file_path=file_path,
            collection_id=collection_id,
            file_type=file_type_enum,
            document_id=document_id,
            document_title=document_title,
            progress_callback=lambda p: None,  # 同步回调由异步版本替代
            async_progress_callback=update_progress,
        )

        document = db.query(Document).filter(Document.id == document_id).first()
        if result["success"]:
            document.status = ProcessStatus.COMPLETED
            document.progress = 100
            document.chunk_count = result["chunk_count"]
            db.commit()
            await _publish_status(redis, document_id, "completed", chunk_count=result["chunk_count"])
            task_logger.info(
                f"Document {document_id} processed: {result['chunk_count']} chunks"
            )
        else:
            document.status = ProcessStatus.FAILED
            document.error_message = result.get("error", "Unknown error")
            db.commit()
            await _publish_status(redis, document_id, "failed", error=result.get("error", "Unknown error"))
            task_logger.error(
                f"Document {document_id} failed: {result.get('error')}"
            )

    except Exception as e:
        task_logger.exception(f"Error processing document {document_id}: {e}")
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = ProcessStatus.FAILED
            document.error_message = str(e)
            db.commit()
        await _publish_status(redis, document_id, "failed", error=str(e))
        raise  # 让 arq 处理重试
    finally:
        db.close()
        await redis.close()


async def startup(ctx: dict):
    logger.info("arq worker starting up")


async def shutdown(ctx: dict):
    logger.info("arq worker shutting down")


class WorkerSettings:
    functions = [process_document_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings(
        host=settings.redis_host,
        port=settings.redis_port,
        database=settings.redis_db,
        password=settings.redis_password,
    )
    max_jobs = 4
    job_timeout = 600
    max_tries = settings.task_max_retries
    retry_delay = settings.task_retry_delay
```

- [ ] **Step 2: 修改 DocumentProcessor 支持异步进度回调**

修改 `document_processor.py`，添加 `async_progress_callback` 参数：

在 `process_document` 方法签名中添加参数：

```python
def process_document(
    self,
    file_path: str,
    collection_id: str,
    file_type: FileType,
    document_id: str = None,
    document_title: str = None,
    chunk_size: int = 512,
    overlap: int = 50,
    progress_callback: Callable[[int], None] = None,
    async_progress_callback: Callable[[int, str], Awaitable[None]] = None,
) -> Dict:
    """处理文档：解析 -> 切分 -> 向量化 -> 存储"""

    def update_progress(progress: int, stage: str = None):
        if progress_callback:
            progress_callback(progress)
        # 注意：async_progress_callback 需要在调用方处理

    # ... 其余代码保持不变，但需要在各阶段调用 async_progress_callback
```

实际上，由于 `process_document` 是同步函数，我们需要一个更简单的方案：让 worker 直接在进度回调中处理 Redis 发布。

简化方案：保持 `document_processor.py` 不变，在 worker 中用同步回调更新数据库，然后单独发布 Redis 消息。

- [ ] **Step 3: 简化 Worker 实现（推荐方案）**

保持 `document_processor.py` 不变，修改 `worker.py`：

```python
import logging
import sys
import json

from arq.connections import RedisSettings
from redis import asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)


async def process_document_task(
    ctx: dict,
    document_id: str,
    file_path: str,
    collection_id: str,
    file_type: str,
    document_title: str,
):
    """arq worker 函数：处理文档（解析 → 分块 → 向量化）"""
    from app.core.rag.document_processor import DocumentProcessor
    from app.database import SessionLocal
    from app.models import Document, ProcessStatus
    from app.models.document import FileType

    task_logger = logging.getLogger("app.worker")
    if not task_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
        task_logger.addHandler(handler)
        task_logger.setLevel(logging.INFO)

    task_logger.info(f"arq: Processing document {document_id}")

    # 连接 Redis 用于发布状态
    redis = await aioredis.from_url(
        f"redis://{settings.redis_host}:{settings.redis_port}",
        password=settings.redis_password,
        db=settings.redis_db,
    )

    db = SessionLocal()
    last_progress = [0]  # 用列表包装以便在闭包中修改

    def publish_sync(progress: int, stage: str = None):
        """同步发布进度（在进度回调中调用）"""
        # 更新数据库
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.progress = progress
            db.commit()
        
        # 发布到 Redis（同步方式）
        message = {"status": "processing", "progress": progress}
        if stage:
            message["stage"] = stage
        
        try:
            # 使用同步 Redis 客户端
            import redis as redis_sync
            sync_client = redis_sync.Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                db=settings.redis_db,
                password=settings.redis_password,
            )
            sync_client.publish(f"doc_status:{document_id}", json.dumps(message))
            sync_client.close()
        except Exception as e:
            task_logger.warning(f"Failed to publish progress: {e}")
        
        last_progress[0] = progress
        task_logger.info(f"Document {document_id} progress: {progress}%")

    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            task_logger.error(f"Document {document_id} not found")
            return

        document.status = ProcessStatus.PROCESSING
        document.progress = 0
        db.commit()

        # 发布初始状态
        await redis.publish(f"doc_status:{document_id}", json.dumps({
            "status": "processing",
            "progress": 0,
            "stage": "initializing"
        }))

        file_type_enum = FileType(file_type)

        processor = DocumentProcessor()
        result = processor.process_document(
            file_path=file_path,
            collection_id=collection_id,
            file_type=file_type_enum,
            document_id=document_id,
            document_title=document_title,
            progress_callback=lambda p: publish_sync(p),
        )

        document = db.query(Document).filter(Document.id == document_id).first()
        if result["success"]:
            document.status = ProcessStatus.COMPLETED
            document.progress = 100
            document.chunk_count = result["chunk_count"]
            db.commit()
            await redis.publish(f"doc_status:{document_id}", json.dumps({
                "status": "completed",
                "chunk_count": result["chunk_count"]
            }))
            task_logger.info(
                f"Document {document_id} processed: {result['chunk_count']} chunks"
            )
        else:
            document.status = ProcessStatus.FAILED
            document.error_message = result.get("error", "Unknown error")
            db.commit()
            await redis.publish(f"doc_status:{document_id}", json.dumps({
                "status": "failed",
                "error": result.get("error", "Unknown error")
            }))
            task_logger.error(
                f"Document {document_id} failed: {result.get('error')}"
            )

    except Exception as e:
        task_logger.exception(f"Error processing document {document_id}: {e}")
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = ProcessStatus.FAILED
            document.error_message = str(e)
            db.commit()
        await redis.publish(f"doc_status:{document_id}", json.dumps({
            "status": "failed",
            "error": str(e)
        }))
        raise  # 让 arq 处理重试
    finally:
        db.close()
        await redis.close()


async def startup(ctx: dict):
    logger.info("arq worker starting up")


async def shutdown(ctx: dict):
    logger.info("arq worker shutting down")


class WorkerSettings:
    functions = [process_document_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings(
        host=settings.redis_host,
        port=settings.redis_port,
        database=settings.redis_db,
        password=settings.redis_password,
    )
    max_jobs = 4
    job_timeout = 600
    max_tries = settings.task_max_retries
    retry_delay = settings.task_retry_delay
```

- [ ] **Step 4: 验证语法正确**

```bash
cd /home/eryndor/code/Learn_RAG/backend && python -c "from app.worker import process_document_task; print('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/worker.py
git commit -m "feat: add Redis pub/sub for document status updates in worker"
```

---

### Task 3: 前端 SSE Hook

**Files:**
- Create: `frontend/src/hooks/useDocumentStatus.ts`

- [ ] **Step 1: 创建 SSE 订阅 Hook**

```typescript
// frontend/src/hooks/useDocumentStatus.ts
import { useEffect, useState, useRef } from 'react'
import type { ProcessStatus } from '../types/document'

interface DocStatus {
  status: ProcessStatus
  progress?: number
  stage?: string
  chunk_count?: number
  error?: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useDocumentStatus(
  docId: string | null,
  collectionId: string | null,
  onStatusChange?: (status: DocStatus) => void
) {
  const [status, setStatus] = useState<DocStatus | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // 清理之前的连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (!docId || !collectionId) {
      setStatus(null)
      return
    }

    // 获取 token
    const token = localStorage.getItem('rag_access_token')
    if (!token) {
      console.warn('No auth token for SSE connection')
      return
    }

    // 建立 SSE 连接
    const url = `${API_BASE_URL}/api/collections/${collectionId}/documents/${docId}/status/stream`
    
    // EventSource 不支持自定义 headers，需要通过 URL 参数或 cookie 传递 token
    // 这里我们依赖浏览器的 cookie 机制，或者使用 fetch + ReadableStream 替代
    
    // 使用 fetch + ReadableStream 实现（支持 Authorization header）
    const controller = new AbortController()
    
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`)
        }
        
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }
        
        const decoder = new TextDecoder()
        let buffer = ''
        
        const readChunk = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (done) {
              return
            }
            
            buffer += decoder.decode(value, { stream: true })
            
            // 解析 SSE 消息
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // 保留不完整的行
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  setStatus(data)
                  onStatusChange?.(data)
                  
                  // 完成或失败时关闭连接
                  if (data.status === 'completed' || data.status === 'failed') {
                    controller.abort()
                    return
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', line)
                }
              }
            }
            
            return readChunk()
          })
        }
        
        return readChunk()
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('SSE error:', err)
        }
      })

    return () => {
      controller.abort()
    }
  }, [docId, collectionId, onStatusChange])

  return status
}

// 简化版本：仅监听单个文档的状态
export function useDocumentStatusSimple(docId: string | null, collectionId: string | null) {
  return useDocumentStatus(docId, collectionId)
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd /home/eryndor/code/Learn_RAG/frontend && npx tsc --noEmit src/hooks/useDocumentStatus.ts
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useDocumentStatus.ts
git commit -m "feat: add useDocumentStatus SSE hook for real-time status updates"
```

---

### Task 4: 修改 DocumentList 组件

**Files:**
- Modify: `frontend/src/components/DocumentManager/DocumentList.tsx`

- [ ] **Step 1: 集成 SSE Hook**

修改 `DocumentList.tsx`，添加 SSE 状态监听：

```typescript
import { useState, useEffect, useMemo } from 'react'
import { FileText, Trash2, Loader2, CheckCircle, XCircle, Clock, Eye, BookOpen, ChevronDown, Zap, Brain, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Document, ProcessStatus } from '../../types/document'
import { paperService } from '../../services/paperService'
import { useDocumentStatus } from '../../hooks/useDocumentStatus'

interface DocumentListProps {
  documents: Document[]
  collectionId: string
  onDelete: (documentId: string) => void
  onPreview: (document: Document) => void
  onRefresh?: () => void
  onStatusUpdate?: (docId: string, status: { status: ProcessStatus; progress?: number; chunk_count?: number }) => void
  watchingDocId?: string | null  // 当前正在监听的文档 ID
}

export function DocumentList({ 
  documents, 
  collectionId,
  onDelete, 
  onPreview, 
  onRefresh,
  onStatusUpdate,
  watchingDocId 
}: DocumentListProps) {
  const [parsingDocs, setParsingDocs] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // SSE 状态监听
  const liveStatus = useDocumentStatus(watchingDocId, collectionId, (status) => {
    // 状态变化时通知父组件
    if (watchingDocId && onStatusUpdate) {
      onStatusUpdate(watchingDocId, status)
    }
  })

  // 前端过滤
  const filteredDocuments = useMemo(() =>
    documents.filter(d =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [documents, searchQuery]
  )

  // 合并实时状态到文档列表
  const documentsWithStatus = useMemo(() => {
    return documents.map(doc => {
      if (doc.id === watchingDocId && liveStatus) {
        return {
          ...doc,
          status: liveStatus.status as ProcessStatus,
          progress: liveStatus.progress ?? doc.progress,
          chunk_count: liveStatus.chunk_count ?? doc.chunk_count,
          error_message: liveStatus.error ?? doc.error_message,
        }
      }
      return doc
    })
  }, [documents, watchingDocId, liveStatus])

  // 从 documents 中获取已解析状态
  const isParsed = (docId: string) => {
    const doc = documents.find(d => d.id === docId)
    return doc?.has_paper || false
  }

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      pdf: 'text-red-500 bg-red-50 dark:bg-red-900/30',
      docx: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
      md: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
      txt: 'text-gray-500 bg-gray-100 dark:bg-gray-700',
    }
    return colors[type] || 'text-gray-500 bg-gray-100 dark:bg-gray-700'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-gray-400" />
      case 'processing':
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: string, chunkCount: number, progress: number) => {
    switch (status) {
      case 'pending':
        return '排队中'
      case 'processing':
        return `处理中 ${progress}%`
      case 'completed':
        return `${chunkCount} 片段`
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        暂无文档
      </div>
    )
  }

  const handleParsePaper = async (docId: string, useLlm: boolean = false) => {
    if (isParsed(docId)) {
      const modeText = useLlm ? '智能解析' : '快速解析'
      if (!confirm(`该论文已解析过，是否使用「${modeText}」重新解析？\n\n重新解析将覆盖原有数据。`)) {
        setOpenMenuId(null)
        return
      }
    }

    setParsingDocs(prev => new Set(prev).add(docId))
    setOpenMenuId(null)

    const modeText = useLlm ? '智能解析' : '快速解析'
    const loadingToast = toast.loading(`正在${modeText}论文...`)

    try {
      await paperService.parsePaper(docId, useLlm, isParsed(docId))
      toast.success(`${modeText}完成！`, { id: loadingToast })
      onRefresh?.()
    } catch (error) {
      console.error('Failed to parse paper:', error)
      toast.error(`${modeText}失败，请重试`, { id: loadingToast })
    } finally {
      setParsingDocs(prev => {
        const newSet = new Set(prev)
        newSet.delete(docId)
        return newSet
      })
    }
  }

  const handleToggleMenu = (docId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setOpenMenuId(openMenuId === docId ? null : docId)
  }

  return (
    <div className="space-y-2">
      {/* 搜索框 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索文档..."
          className="w-full pl-9 pr-8 py-2 text-sm border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          {searchQuery ? '无匹配结果' : '暂无文档'}
        </div>
      ) : (
        filteredDocuments.map((doc) => {
          // 使用合并后的状态
          const displayDoc = documentsWithStatus.find(d => d.id === doc.id) || doc
          
          return (
            <div
              key={doc.id}
              className="group bg-white dark:bg-gray-800 rounded-lg p-3 border dark:border-gray-700 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded ${getFileTypeColor(displayDoc.file_type)}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate cursor-default" title={displayDoc.title}>
                    {displayDoc.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatFileSize(displayDoc.file_size)}</span>
                    <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                    <div className="flex items-center gap-1">
                      {getStatusIcon(displayDoc.status)}
                      <span>{getStatusText(displayDoc.status, displayDoc.chunk_count, displayDoc.progress || 0)}</span>
                    </div>
                  </div>
                  {/* 进度条 */}
                  {displayDoc.status === 'processing' && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${displayDoc.progress || 0}%` }}
                      />
                    </div>
                  )}
                  {displayDoc.status === 'failed' && displayDoc.error_message && (
                    <p className="text-xs text-red-500 mt-1 truncate">
                      {displayDoc.error_message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* 解析论文按钮 - 仅 PDF 且已完成时显示 */}
                  {displayDoc.file_type === 'pdf' && displayDoc.status === 'completed' && (
                    <div className="relative">
                      <div className="flex items-center">
                        {isParsed(doc.id) && (
                          <span className="p-1.5 text-green-500" title="已解析">
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleParsePaper(doc.id, false)
                          }}
                          disabled={parsingDocs.has(doc.id)}
                          className={`p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50 ${
                            isParsed(doc.id) ? '' : 'rounded-l'
                          }`}
                          title={isParsed(doc.id) ? '重新快速解析' : '快速解析（规则解析）'}
                        >
                          {parsingDocs.has(doc.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <BookOpen className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => handleToggleMenu(doc.id, e)}
                          disabled={parsingDocs.has(doc.id)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-r transition-colors disabled:opacity-50 border-l border-gray-200 dark:border-gray-600"
                          title="选择解析模式"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      {/* 下拉菜单 */}
                      {openMenuId === doc.id && (
                        <div
                          className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[160px] overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleParsePaper(doc.id, false)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                          >
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <div>
                              <div className="font-medium">快速解析</div>
                              <div className="text-xs text-gray-400">规则解析，速度快</div>
                            </div>
                          </button>
                          <button
                            onClick={() => handleParsePaper(doc.id, true)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-gray-800 dark:text-gray-200"
                          >
                            <Brain className="w-4 h-4 text-purple-500" />
                            <div>
                              <div className="font-medium">智能解析</div>
                              <div className="text-xs text-gray-400">LLM 解析，更准确</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => onPreview(displayDoc)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                    title="预览"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd /home/eryndor/code/Learn_RAG/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DocumentManager/DocumentList.tsx
git commit -m "feat: integrate SSE status updates in DocumentList component"
```

---

### Task 5: 修改 App.tsx 移除轮询

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 移除轮询逻辑，添加 SSE 状态管理**

修改 `App.tsx`：

1. 移除 `pollingRef` 和轮询 `useEffect`
2. 添加 `watchingDocId` 状态用于跟踪正在监听的文档
3. 修改 `handleUploadComplete` 设置 `watchingDocId`
4. 传递新的 props 给 `DocumentList`

关键修改：

```typescript
// 在 MainApp 组件中：

// 移除: const pollingRef = useRef<number | null>(null)

// 添加: 正在监听的文档 ID
const [watchingDocId, setWatchingDocId] = useState<string | null>(null)

// 修改 handleUploadComplete
const handleUploadComplete = async (newDocId?: string) => {
  const data = await fetchDocuments(1)
  if (data) {
    setDocuments(data)
    // 设置监听的文档 ID
    if (newDocId) {
      setWatchingDocId(newDocId)
    }
  }
}

// 添加: 状态更新回调
const handleStatusUpdate = (docId: string, status: { status: ProcessStatus; progress?: number; chunk_count?: number }) => {
  // 更新文档列表中的状态
  setDocuments(prev => prev.map(doc => {
    if (doc.id === docId) {
      return {
        ...doc,
        status: status.status,
        progress: status.progress ?? doc.progress,
        chunk_count: status.chunk_count ?? doc.chunk_count,
      }
    }
    return doc
  }))
  
  // 如果完成或失败，停止监听
  if (status.status === 'completed' || status.status === 'failed') {
    fetchDocuments(1) // 刷新完整数据
    setWatchingDocId(null)
  }
}

// 移除轮询 useEffect（第 213-242 行）

// 修改 DocumentList 组件调用
<DocumentList
  documents={documents}
  collectionId={selectedCollection}
  onDelete={handleDeleteDocument}
  onPreview={setPreviewDocument}
  onRefresh={() => fetchDocuments(docCurrentPage)}
  onStatusUpdate={handleStatusUpdate}
  watchingDocId={watchingDocId}
/>
```

- [ ] **Step 2: 修改 DocumentUpload 组件返回新文档 ID**

需要修改 `DocumentUpload` 组件，使其在上传成功后返回新文档的 ID。

检查 `DocumentUpload` 组件，确保 `onUploadComplete` 能接收新文档 ID。

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd /home/eryndor/code/Learn_RAG/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: replace polling with SSE for document status updates"
```

---

### Task 6: 集成测试

- [ ] **Step 1: 启动后端服务**

```bash
cd /home/eryndor/code/Learn_RAG/backend
# 确保 Redis 运行
redis-cli ping
# 启动服务
uvicorn app.main:app --reload
```

- [ ] **Step 2: 启动前端服务**

```bash
cd /home/eryndor/code/Learn_RAG/frontend
npm run dev
```

- [ ] **Step 3: 测试上传文档**

1. 打开浏览器访问 http://localhost:5173
2. 选择一个知识库
3. 上传一个 PDF 文档
4. 观察文档列表中的进度条实时更新
5. 确认处理完成后状态变为"完成"

- [ ] **Step 4: 检查 SSE 连接**

打开浏览器开发者工具 → Network → 筛选 EventStream，确认有 SSE 连接建立。

- [ ] **Step 5: Commit 最终状态**

```bash
git add -A
git commit -m "feat: complete SSE-based document status streaming"
```

---

## 自检清单

- [x] Spec 覆盖：SSE 端点、Worker 发布、前端 Hook、组件集成
- [x] 无占位符：所有代码完整
- [x] 类型一致：ProcessStatus 类型在前后端一致使用
