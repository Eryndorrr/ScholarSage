"""
认证 API

提供用户注册、登录、信息查询和密码管理接口
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    ChangePasswordRequest, UpdateProfileRequest,
)
from app.core.auth import (
    hash_password, verify_password, create_access_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """用户注册"""
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="用户名已被注册")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="邮箱已被注册")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="账户已被禁用")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse.model_validate(current_user)


@router.put("/password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """修改密码"""
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="当前密码错误")

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"success": True, "message": "密码已修改"}


@router.put("/profile", response_model=UserResponse)
def update_profile(
    data: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """修改个人资料（邮箱）"""
    if data.email is not None:
        # 检查邮箱唯一性（排除自己）
        existing = db.query(User).filter(
            User.email == data.email,
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="邮箱已被使用")
        current_user.email = data.email

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)
