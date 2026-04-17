"""
管理员 API

提供用户管理接口（仅管理员可访问）
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.collection import Collection
from app.schemas.auth import UserUpdateRequest, AdminUserResponse, AdminResetPasswordRequest
from app.core.auth import get_current_admin, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _build_admin_response(user: User, db: Session) -> AdminUserResponse:
    col_count = db.query(func.count(Collection.id)).filter(
        Collection.user_id == user.id
    ).scalar() or 0
    return AdminUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        collection_count=col_count,
    )


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """获取所有用户列表（管理员）"""
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = [_build_admin_response(u, db) for u in users]
    return {"users": result, "total": len(result)}


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """更新用户信息（管理员）：角色变更、启用/禁用"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if user.id == current_user.id and data.is_active is False:
        raise HTTPException(status_code=400, detail="不能禁用自己")

    if user.id == current_user.id and data.role == "user":
        raise HTTPException(status_code=400, detail="不能降级自己的角色")

    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)
    return _build_admin_response(user, db)


@router.put("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    data: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """重置用户密码（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"success": True, "message": f"用户 {user.username} 密码已重置"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """删除用户及其所有数据（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    db.delete(user)
    db.commit()
    return {"success": True, "message": f"用户 {user.username} 已删除"}
