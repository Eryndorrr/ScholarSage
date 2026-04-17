"""
JWT 认证核心模块

提供密码加密、JWT 令牌管理和用户认证依赖
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 方案 — 从 Authorization: Bearer <token> 中提取令牌
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    """加密密码"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建 JWT 令牌"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=settings.jwt_expire_hours)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """解码 JWT 令牌"""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI 依赖：从请求中提取并验证当前用户

    用法：
        @router.get("/protected")
        def protected_route(current_user: User = Depends(get_current_user)):
            ...
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exception

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """FastAPI 依赖：要求当前用户为管理员"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current_user
