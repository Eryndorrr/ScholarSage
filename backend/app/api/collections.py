from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Collection
from app.schemas import CollectionCreate, CollectionUpdate, CollectionResponse

router = APIRouter(prefix="/api/collections", tags=["collections"])


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
    return {"collections": [CollectionResponse.model_validate(c) for c in collections]}


@router.get("/{collection_id}", response_model=CollectionResponse)
def get_collection(collection_id: str, db: Session = Depends(get_db)):
    """获取单个知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return collection


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
    return collection


@router.delete("/{collection_id}")
def delete_collection(collection_id: str, db: Session = Depends(get_db)):
    """删除知识库"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")

    db.delete(collection)
    db.commit()
    return {"success": True, "message": "知识库已删除"}