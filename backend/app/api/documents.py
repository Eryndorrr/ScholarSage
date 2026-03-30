from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Document, Collection, FileType, ProcessStatus
from app.schemas import DocumentResponse
from app.core.rag.document_processor import DocumentProcessor
import os
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/collections/{collection_id}/documents", tags=["documents"])


def process_document_task(document_id: str, file_path: str, collection_id: str, file_type: FileType):
    """后台任务：处理文档"""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        # 更新状态为处理中
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            logger.error(f"Document {document_id} not found")
            return

        document.status = ProcessStatus.PROCESSING
        db.commit()
        logger.info(f"Processing document: {document.title} ({document_id})")

        # 处理文档
        processor = DocumentProcessor()
        result = processor.process_document(
            file_path=file_path,
            collection_id=collection_id,
            file_type=file_type
        )

        # 更新处理结果
        document = db.query(Document).filter(Document.id == document_id).first()
        if result["success"]:
            document.status = ProcessStatus.COMPLETED
            document.chunk_count = result["chunk_count"]
            logger.info(f"Document {document_id} processed successfully: {result['chunk_count']} chunks")
        else:
            document.status = ProcessStatus.FAILED
            document.error_message = result.get("error", "Unknown error")
            logger.error(f"Document {document_id} processing failed: {result.get('error')}")
        db.commit()

    except Exception as e:
        logger.exception(f"Error processing document {document_id}: {e}")
        # 更新失败状态
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = ProcessStatus.FAILED
            document.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("", response_model=DocumentResponse)
async def upload_document(
    collection_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传文档并自动处理"""
    # 验证collection是否存在
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

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
        file_size=len(content),
        status=ProcessStatus.PENDING
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # 后台处理文档（向量化）
    background_tasks.add_task(
        process_document_task,
        document.id,
        file_path,
        collection_id,
        file_type
    )

    return document


@router.get("", response_model=List[DocumentResponse])
def list_documents(collection_id: str, db: Session = Depends(get_db)):
    """获取文档列表"""
    documents = db.query(Document).filter(
        Document.collection_id == collection_id
    ).all()
    return documents


@router.delete("/{document_id}")
def delete_document(
    collection_id: str,
    document_id: str,
    db: Session = Depends(get_db)
):
    """删除文档"""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.collection_id == collection_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # 删除文件
    if document.file_path and os.path.exists(document.file_path):
        os.remove(document.file_path)

    # 删除数据库记录
    db.delete(document)
    db.commit()

    return {"success": True, "message": "Document deleted"}