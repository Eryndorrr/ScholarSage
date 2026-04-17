from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from app.database import get_db
from app.models import Session, SessionMessage, Collection
from app.models.user import User
from app.schemas.session import (
    SessionCreate,
    SessionUpdate,
    SessionResponse,
    SessionWithMessages,
    SessionListResponse,
    SessionMessageResponse
)
from app.core.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _verify_collection_owner(collection_id: str, current_user: User, db: Session):
    """验证知识库属于当前用户"""
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return collection


def _verify_session_owner(session_id: str, current_user: User, db: Session):
    """验证会话属于当前用户（通过 collection 间接验证）"""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    collection = db.query(Collection).filter(
        Collection.id == session.collection_id,
        Collection.user_id == current_user.id,
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


@router.post("", response_model=SessionResponse)
def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建新会话"""
    _verify_collection_owner(session_data.collection_id, current_user, db)

    new_session = Session(
        collection_id=session_data.collection_id,
        title=session_data.title or "新对话",
        web_search_enabled=session_data.web_search_enabled
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.get("", response_model=SessionListResponse)
def list_sessions(
    collection_id: str,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取知识库的会话列表"""
    _verify_collection_owner(collection_id, current_user, db)

    total = db.query(Session).filter(Session.collection_id == collection_id).count()
    sessions = (
        db.query(Session)
        .filter(Session.collection_id == collection_id)
        .order_by(desc(Session.updated_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return SessionListResponse(sessions=sessions, total=total)


@router.get("/{session_id}", response_model=SessionWithMessages)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取会话详情（包含消息）"""
    session = _verify_session_owner(session_id, current_user, db)

    return SessionWithMessages(
        id=session.id,
        collection_id=session.collection_id,
        title=session.title,
        summary=session.summary,
        message_count=session.message_count,
        is_active=session.is_active,
        web_search_enabled=session.web_search_enabled,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[
            SessionMessageResponse(
                id=msg.id,
                session_id=msg.session_id,
                role=msg.role,
                content=msg.content,
                sources=msg.sources,
                web_search_results=msg.web_search_results,
                created_at=msg.created_at
            )
            for msg in session.messages
        ]
    )


@router.put("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: str,
    update_data: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新会话"""
    session = _verify_session_owner(session_id, current_user, db)

    if update_data.title is not None:
        session.title = update_data.title
    if update_data.web_search_enabled is not None:
        session.web_search_enabled = update_data.web_search_enabled

    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除会话"""
    session = _verify_session_owner(session_id, current_user, db)

    db.delete(session)
    db.commit()
    return {"success": True, "message": "会话已删除"}


@router.delete("/collection/{collection_id}")
def clear_sessions(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """清空知识库的所有会话"""
    _verify_collection_owner(collection_id, current_user, db)

    count = db.query(Session).filter(Session.collection_id == collection_id).delete()
    db.commit()
    return {"success": True, "deleted_count": count}
