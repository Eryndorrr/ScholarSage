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


def process_document_task(document_id: str, file_path: str, collection_id: str, file_type: FileType, document_title: str):
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
        document.progress = 0
        db.commit()
        logger.info(f"Processing document: {document.title} ({document_id})")

        # 进度回调函数
        def update_progress(progress: int):
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.progress = progress
                db.commit()

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
        file_type,
        filename  # 传递文档标题
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

    # 删除向量数据
    from app.core.rag.vector_store import VectorStore
    try:
        vector_store = VectorStore()
        deleted_count = vector_store.delete_document(collection_id, document_id)
        logger.info(f"Deleted {deleted_count} vectors for document {document_id}")
    except Exception as e:
        logger.warning(f"Failed to delete vectors: {e}")

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
    db: Session = Depends(get_db)
):
    """获取文档内容（用于预览）"""
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
        raise HTTPException(status_code=500, detail=f"读取文档失败: {str(e)}")


from fastapi.responses import FileResponse, Response

@router.get("/{document_id}/file")
def get_document_file(
    collection_id: str,
    document_id: str,
    db: Session = Depends(get_db)
):
    """获取文档文件（用于PDF预览）"""
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