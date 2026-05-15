from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Document, Collection, FileType, ProcessStatus, Paper
from app.models.user import User
from app.schemas import DocumentResponse, DuplicateCheckResponse, DocumentListResponse
from app.core.rag.document_processor import DocumentProcessor
from app.core.auth import get_current_user
import os
import re
import uuid
import hashlib
import logging

logger = logging.getLogger(__name__)
logger.info("=== documents.py module loaded ===")

router = APIRouter(prefix="/api/collections/{collection_id}/documents", tags=["documents"])


def _verify_collection_owner(collection_id: str, current_user: User, db: Session) -> Collection:
    """验证知识库属于当前用户"""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return collection


def calculate_file_hash(content: bytes) -> str:
    """计算文件的 SHA256 哈希值"""
    return hashlib.sha256(content).hexdigest()


def _sanitize_filename(filename: str) -> str:
    """清洗文件名，去除路径遍历和特殊字符"""
    name = os.path.basename(filename or "untitled")
    name = re.sub(r'[^\w一-鿿\-_. ]', '', name)
    return name or "untitled"


def _validate_file_size(size: int):
    """校验文件大小是否超限"""
    from app.config import settings as app_settings
    if size > app_settings.max_upload_size:
        max_mb = app_settings.max_upload_size // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"文件大小超过限制（最大 {max_mb}MB）"
        )


def _ensure_safe_path(file_path: str):
    """确保文件路径在 uploads 目录内（防止路径遍历）"""
    uploads_dir = os.path.realpath("./uploads")
    real_path = os.path.realpath(file_path)
    if not real_path.startswith(uploads_dir + os.sep) and real_path != uploads_dir:
        raise HTTPException(status_code=400, detail="非法文件路径")


def _publish_status_sync(document_id: str, message: dict):
    """同步发布状态到 Redis（用于 BackgroundTasks）"""
    import json
    import redis as redis_sync
    from app.config import settings as app_settings

    try:
        client = redis_sync.Redis(
            host=app_settings.redis_host,
            port=app_settings.redis_port,
            db=app_settings.redis_db,
            password=app_settings.redis_password,
        )
        client.publish(f"doc_status:{document_id}", json.dumps(message))
        client.close()
    except Exception as e:
        logger.warning(f"Failed to publish status: {e}")


def process_document_task(document_id: str, file_path: str, collection_id: str, file_type: FileType, document_title: str):
    """后台任务：处理文档"""
    from app.database import SessionLocal
    import sys

    # 后台任务中重新配置日志（确保在独立线程中也能正确输出）
    task_logger = logging.getLogger('app.api.documents')
    if not task_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        task_logger.addHandler(handler)
        task_logger.setLevel(logging.INFO)

    task_logger.info(f"Starting background task for document: {document_id}")

    # 发布处理开始状态
    _publish_status_sync(document_id, {
        "status": "processing",
        "progress": 0,
        "stage": "initializing",
    })

    db = SessionLocal()
    try:
        # 更新状态为处理中
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            task_logger.error(f"Document {document_id} not found")
            _publish_status_sync(document_id, {
                "status": "failed",
                "error": "Document not found",
            })
            return

        document.status = ProcessStatus.PROCESSING
        document.progress = 0
        db.commit()
        task_logger.info(f"Processing document: {document.title} ({document_id})")

        # 进度回调函数
        def update_progress(progress: int):
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.progress = progress
                db.commit()
            task_logger.info(f"Document {document_id} progress: {progress}%")
            # 发布进度更新
            _publish_status_sync(document_id, {
                "status": "processing",
                "progress": progress,
                "stage": "processing",
            })

        # 处理文档
        processor = DocumentProcessor()
        result = processor.process_document(
            file_path=file_path,
            collection_id=collection_id,
            file_type=file_type,
            document_id=document_id,
            document_title=document_title,
            progress_callback=update_progress
        )

        # 更新处理结果
        document = db.query(Document).filter(Document.id == document_id).first()
        if result["success"]:
            document.status = ProcessStatus.COMPLETED
            document.progress = 100
            document.chunk_count = result["chunk_count"]
            db.commit()
            task_logger.info(f"Document {document_id} processed successfully: {result['chunk_count']} chunks")
            # 发布完成状态
            _publish_status_sync(document_id, {
                "status": "completed",
                "chunk_count": result["chunk_count"],
            })
        else:
            document.status = ProcessStatus.FAILED
            document.error_message = result.get("error", "Unknown error")
            db.commit()
            task_logger.error(f"Document {document_id} processing failed: {result.get('error')}")
            # 发布失败状态
            _publish_status_sync(document_id, {
                "status": "failed",
                "error": result.get("error", "Unknown error"),
            })

    except Exception as e:
        task_logger.exception(f"Error processing document {document_id}: {e}")
        # 更新失败状态
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = ProcessStatus.FAILED
            document.error_message = str(e)
            db.commit()
        # 发布异常失败状态
        _publish_status_sync(document_id, {
            "status": "failed",
            "error": str(e),
        })
    finally:
        db.close()


@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(
    collection_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    检查上传的文件是否重复

    通过计算文件内容的 SHA256 哈希值，检查同一知识库中是否已存在相同内容的文档
    """
    _verify_collection_owner(collection_id, current_user, db)

    # 读取文件内容并计算哈希
    content = await file.read()
    _validate_file_size(len(content))
    file_hash = calculate_file_hash(content)

    # 重置文件指针以便后续可能的读取
    await file.seek(0)

    # 检查是否已存在相同哈希的文档
    existing_doc = db.query(Document).filter(
        Document.collection_id == collection_id,
        Document.file_hash == file_hash
    ).first()

    if existing_doc:
        return DuplicateCheckResponse(
            is_duplicate=True,
            existing_document=DocumentResponse.model_validate(existing_doc)
        )

    return DuplicateCheckResponse(
        is_duplicate=False,
        existing_document=None
    )


@router.post("", response_model=DocumentResponse)
async def upload_document(
    collection_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    skip_duplicate_check: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    上传文档并自动处理

    Args:
        skip_duplicate_check: 是否跳过重复检查（默认 False，会自动检查并拒绝重复文件）
    """
    _verify_collection_owner(collection_id, current_user, db)

    # 确定文件类型（大小写不敏感）
    filename = file.filename or "untitled"
    lower_name = filename.lower()
    if lower_name.endswith('.pdf'):
        file_type = FileType.PDF
    elif lower_name.endswith('.md'):
        file_type = FileType.MD
    elif lower_name.endswith('.docx'):
        file_type = FileType.DOCX
    else:
        raise HTTPException(status_code=400, detail="不支持的文件类型")

    # 读取文件内容
    content = await file.read()
    file_size = len(content)
    _validate_file_size(file_size)

    # 计算文件哈希
    file_hash = calculate_file_hash(content)

    # 检查重复文件
    if not skip_duplicate_check:
        existing_doc = db.query(Document).filter(
            Document.collection_id == collection_id,
            Document.file_hash == file_hash
        ).first()

        if existing_doc:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "检测到重复文件",
                    "existing_document": {
                        "id": existing_doc.id,
                        "title": existing_doc.title,
                        "upload_time": existing_doc.upload_time.isoformat() if existing_doc.upload_time else None
                    }
                }
            )

    # 保存文件
    safe_filename = _sanitize_filename(filename)
    file_id = str(uuid.uuid4())
    file_path = f"./uploads/{file_id}_{safe_filename}"
    os.makedirs("./uploads", exist_ok=True)
    _ensure_safe_path(file_path)

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    # 创建文档记录
    document = Document(
        collection_id=collection_id,
        title=safe_filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        file_hash=file_hash,
        status=ProcessStatus.PENDING
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # 后台处理文档（向量化）
    from app.config import settings as app_settings

    if app_settings.use_task_queue:
        try:
            from arq.connections import RedisSettings, create_pool

            redis_settings = RedisSettings(
                host=app_settings.redis_host,
                port=app_settings.redis_port,
                database=app_settings.redis_db,
                password=app_settings.redis_password,
            )
            redis_pool = await create_pool(redis_settings)
            await redis_pool.enqueue_job(
                "process_document_task",
                document.id,
                file_path,
                collection_id,
                file_type.value,
                filename,
            )
            await redis_pool.close()
            logger.info(f"=== arq job enqueued for document: {document.id} ===")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}), falling back to BackgroundTasks")
            background_tasks.add_task(
                process_document_task,
                document.id,
                file_path,
                collection_id,
                file_type,
                filename,
            )
    else:
        logger.info(f"=== Queuing background task for document: {document.id} ===")
        background_tasks.add_task(
            process_document_task,
            document.id,
            file_path,
            collection_id,
            file_type,
            filename,
        )

    return document


@router.get("", response_model=DocumentListResponse)
def list_documents(
    collection_id: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文档列表（支持分页）"""
    _verify_collection_owner(collection_id, current_user, db)

    # 查询总数
    total = db.query(Document).filter(
        Document.collection_id == collection_id
    ).count()

    # 分页查询
    documents = db.query(Document).filter(
        Document.collection_id == collection_id
    ).order_by(Document.upload_time.desc()).offset(skip).limit(limit).all()

    # 检查每个文档是否有对应的论文记录
    doc_ids = [doc.id for doc in documents]
    papers = db.query(Paper).filter(Paper.document_id.in_(doc_ids)).all() if doc_ids else []
    parsed_doc_ids = {paper.document_id for paper in papers}

    # 为每个文档添加解析状态
    for doc in documents:
        doc.has_paper = doc.id in parsed_doc_ids

    # 返回分页信息在 header 中
    from fastapi import Response
    return {
        "documents": documents,
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(documents) < total
    }


@router.delete("/{document_id}")
def delete_document(
    collection_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除文档"""
    _verify_collection_owner(collection_id, current_user, db)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.collection_id == collection_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # 删除向量数据
    from app.core.rag.vector_store import VectorStore
    from app.core.rag.bm25_retriever import get_bm25_retriever
    try:
        vector_store = VectorStore()
        deleted_count = vector_store.delete_document(collection_id, document_id)
        logger.info(f"Deleted {deleted_count} vectors for document {document_id}")
    except Exception as e:
        logger.warning(f"Failed to delete vectors: {e}")

    # 删除 BM25 索引
    try:
        bm25_retriever = get_bm25_retriever()
        # 删除该文档的所有 chunks
        # 需要找到所有相关的 chunk IDs
        if deleted_count and deleted_count > 0:
            # 由于 BM25 使用 chunk_id，这里需要逐个删除
            # 暂时跳过，因为 chunk_ids 在处理时生成
            pass
    except Exception as e:
        logger.warning(f"Failed to delete from BM25 index: {e}")

    # 删除文件
    if document.file_path and os.path.exists(document.file_path):
        os.remove(document.file_path)

    # 删除数据库记录
    db.delete(document)
    db.commit()

    return {"success": True, "message": "Document deleted"}


@router.get("/{document_id}/content")
def get_document_content(
    collection_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文档内容（用于预览）"""
    _verify_collection_owner(collection_id, current_user, db)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.collection_id == collection_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.file_path or not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    try:
        # 根据文件类型解析内容
        if document.file_type == FileType.PDF:
            from app.core.parsers.pdf_parser import PDFParser
            parser = PDFParser(document.file_path)
            content = parser.extract_text()
        elif document.file_type == FileType.DOCX:
            from app.core.parsers.word_parser import WordParser
            parser = WordParser(document.file_path)
            content = parser.extract_text()
        elif document.file_type == FileType.MD:
            with open(document.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            with open(document.file_path, 'r', encoding='utf-8') as f:
                content = f.read()

        # 限制返回内容长度
        max_length = 50000
        if len(content) > max_length:
            content = content[:max_length] + "\n\n... (内容过长，已截断)"

        return {
            "title": document.title,
            "content": content,
            "file_type": document.file_type.value,
            "char_count": len(content)
        }
    except Exception as e:
        logger.error(f"Failed to read document content: {e}")
        raise HTTPException(status_code=500, detail="读取文档失败")


from fastapi.responses import FileResponse, Response

@router.get("/{document_id}/file")
def get_document_file(
    collection_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文档文件（用于PDF预览）"""
    _verify_collection_owner(collection_id, current_user, db)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.collection_id == collection_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.file_path or not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 读取文件内容
    with open(document.file_path, 'rb') as f:
        content = f.read()

    media_type = "application/pdf" if document.file_type == FileType.PDF else "application/octet-stream"

    # 使用 inline 让浏览器预览而不是下载
    # 使用简单的 ASCII 文件名避免编码问题
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": "inline",
            "Content-Length": str(len(content))
        }
    )


# === SSE 状态流端点 ===
from fastapi.responses import StreamingResponse
import asyncio
import json
from redis import asyncio as aioredis


@router.get("/{document_id}/status")
def get_document_status(
    collection_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回文档当前处理状态，用于状态流兜底轮询。"""
    _verify_collection_owner(collection_id, current_user, db)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.collection_id == collection_id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    return _build_status_message(document)


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
        redis = None
        pubsub = None
        last_payload = None

        def load_current_status() -> dict:
            db.expire_all()
            current_document = db.query(Document).filter(
                Document.id == document_id,
                Document.collection_id == collection_id
            ).first()
            if not current_document:
                return {"status": "failed", "error": "文档不存在"}
            return _build_status_message(current_document)

        def encode_event(payload: dict) -> str:
            return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        async def poll_database_until_terminal():
            nonlocal last_payload
            while True:
                payload = load_current_status()
                payload_text = json.dumps(payload, sort_keys=True, ensure_ascii=False)
                if payload_text != last_payload:
                    last_payload = payload_text
                    yield encode_event(payload)

                if payload.get("status") in ["completed", "failed"]:
                    return

                await asyncio.sleep(2)

        try:
            # 先发送数据库里的当前状态，避免错过已发布的 Pub/Sub 消息。
            current_status = load_current_status()
            last_payload = json.dumps(current_status, sort_keys=True, ensure_ascii=False)
            yield encode_event(current_status)
            if current_status.get("status") in ["completed", "failed"]:
                return

            try:
                # Redis Pub/Sub 提供低延迟进度；DB 轮询负责兜底纠偏。
                redis = await aioredis.from_url(
                    f"redis://{app_settings.redis_host}:{app_settings.redis_port}",
                    password=app_settings.redis_password,
                    db=app_settings.redis_db,
                )
                channel = f"doc_status:{document_id}"
                pubsub = redis.pubsub()
                await pubsub.subscribe(channel)
            except Exception as e:
                logger.warning(f"Redis unavailable for document status stream, using DB polling: {e}")
                async for event in poll_database_until_terminal():
                    yield event
                return

            next_db_check = asyncio.get_running_loop().time() + 2

            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)

                if message and message["type"] == "message":
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

                now = asyncio.get_running_loop().time()
                if now >= next_db_check:
                    current_status = load_current_status()
                    payload_text = json.dumps(current_status, sort_keys=True, ensure_ascii=False)
                    if payload_text != last_payload:
                        last_payload = payload_text
                        yield encode_event(current_status)

                    if current_status.get("status") in ["completed", "failed"]:
                        break
                    next_db_check = now + 2

        except Exception as e:
            logger.error(f"SSE error for document {document_id}: {e}")
            async for event in poll_database_until_terminal():
                yield event
        finally:
            # 确保所有资源都被正确关闭
            if pubsub:
                try:
                    await pubsub.unsubscribe()
                    await pubsub.close()
                except Exception:
                    pass
            if redis:
                try:
                    await redis.close()
                except Exception:
                    pass

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
