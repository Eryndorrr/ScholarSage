from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import logging
from app.database import get_db
from app.models import Collection, Document
from app.schemas import CollectionCreate, CollectionUpdate, CollectionResponse
from app.core.rag.vector_store import VectorStore

router = APIRouter(prefix="/api/collections", tags=["collections"])
logger = logging.getLogger(__name__)


@router.post("", response_model=CollectionResponse)
def create_collection(
    collection: CollectionCreate,
    db: Session = Depends(get_db)
):
    """创建知识库"""
    db_collection = Collection(**collection.model_dump())
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection


@router.get("")
def list_collections(db: Session = Depends(get_db)):
    """获取知识库列表"""
    collections = db.query(Collection).all()
    # 更新每个 collection 的文档数量
    result = []
    for c in collections:
        count = db.query(func.count(Document.id)).filter(
            Document.collection_id == c.id
        ).scalar()
        result.append(CollectionResponse(
            id=c.id,
            name=c.name,
            description=c.description or "",
            color=c.color,
            document_count=count,
            created_at=c.created_at,
            updated_at=c.updated_at
        ))
    return {"collections": result}


@router.get("/{collection_id}", response_model=CollectionResponse)
def get_collection(collection_id: str, db: Session = Depends(get_db)):
    """获取单个知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 获取实际文档数量
    count = db.query(func.count(Document.id)).filter(
        Document.collection_id == collection_id
    ).scalar()

    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description or "",
        color=collection.color,
        document_count=count,
        created_at=collection.created_at,
        updated_at=collection.updated_at
    )


@router.put("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: str,
    collection_update: CollectionUpdate,
    db: Session = Depends(get_db)
):
    """更新知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    update_data = collection_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(collection, key, value)

    db.commit()
    db.refresh(collection)

    # 获取实际文档数量
    count = db.query(func.count(Document.id)).filter(
        Document.collection_id == collection_id
    ).scalar()

    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description or "",
        color=collection.color,
        document_count=count,
        created_at=collection.created_at,
        updated_at=collection.updated_at
    )


@router.delete("/{collection_id}")
def delete_collection(collection_id: str, db: Session = Depends(get_db)):
    """删除知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 获取该知识库的所有文档
    documents = db.query(Document).filter(Document.collection_id == collection_id).all()

    # 删除向量数据（删除整个collection）
    try:
        vector_store = VectorStore()
        vector_store.delete_collection(collection_id)
        logger.info(f"Deleted vector collection {collection_id}")
    except Exception as e:
        # 集合可能不存在，忽略错误
        logger.warning(f"Failed to delete vector collection: {e}")

    # 删除文档文件
    import os
    for doc in documents:
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except Exception as e:
                logger.warning(f"Failed to delete file {doc.file_path}: {e}")

    # 删除数据库记录（级联删除文档）
    db.delete(collection)
    db.commit()

    return {"success": True, "message": "知识库已删除", "deleted_documents": len(documents)}
