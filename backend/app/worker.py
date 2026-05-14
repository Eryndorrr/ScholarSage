import json
import logging
import sys

import redis as redis_sync
from arq.connections import RedisSettings

from app.config import settings

logger = logging.getLogger(__name__)


def publish_sync(document_id: str, message: dict):
    """同步发布状态到 Redis

    Args:
        document_id: 文档 ID
        message: 要发布的消息字典
    """
    try:
        sync_client = redis_sync.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            password=settings.redis_password,
        )
        sync_client.publish(f"doc_status:{document_id}", json.dumps(message))
        sync_client.close()
    except Exception as e:
        logger.warning(f"Failed to publish status: {e}")


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

    # 发布处理开始状态
    publish_sync(document_id, {
        "status": "processing",
        "progress": 0,
        "stage": "initializing",
    })

    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            task_logger.error(f"Document {document_id} not found")
            publish_sync(document_id, {
                "status": "failed",
                "error": "Document not found",
            })
            return

        document.status = ProcessStatus.PROCESSING
        document.progress = 0
        db.commit()

        def update_progress(progress: int):
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.progress = progress
                db.commit()
            task_logger.info(f"Document {document_id} progress: {progress}%")
            # 发布进度更新到 Redis
            publish_sync(document_id, {
                "status": "processing",
                "progress": progress,
                "stage": "processing",
            })

        file_type_enum = FileType(file_type)

        processor = DocumentProcessor()
        result = processor.process_document(
            file_path=file_path,
            collection_id=collection_id,
            file_type=file_type_enum,
            document_id=document_id,
            document_title=document_title,
            progress_callback=update_progress,
        )

        document = db.query(Document).filter(Document.id == document_id).first()
        if result["success"]:
            document.status = ProcessStatus.COMPLETED
            document.progress = 100
            document.chunk_count = result["chunk_count"]
            task_logger.info(
                f"Document {document_id} processed: {result['chunk_count']} chunks"
            )
            # 发布处理完成状态
            publish_sync(document_id, {
                "status": "completed",
                "chunk_count": result["chunk_count"],
            })
        else:
            document.status = ProcessStatus.FAILED
            document.error_message = result.get("error", "Unknown error")
            task_logger.error(
                f"Document {document_id} failed: {result.get('error')}"
            )
            # 发布处理失败状态
            publish_sync(document_id, {
                "status": "failed",
                "error": result.get("error", "Unknown error"),
            })
        db.commit()

    except Exception as e:
        task_logger.exception(f"Error processing document {document_id}: {e}")
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = ProcessStatus.FAILED
            document.error_message = str(e)
            db.commit()
        # 发布处理异常失败状态
        publish_sync(document_id, {
            "status": "failed",
            "error": str(e),
        })
        raise  # 让 arq 处理重试
    finally:
        db.close()


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
