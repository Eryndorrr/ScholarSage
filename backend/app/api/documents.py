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