from sqlalchemy import Column, String, Boolean, DateTime
from datetime import datetime, timezone
from app.database import Base
import uuid


class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user", nullable=False, index=True)  # admin / user
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
