from pydantic import BaseModel, Field, field_validator
from pydantic import EmailStr
from datetime import datetime
from typing import Optional, Literal


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("密码需包含至少一个大写字母")
        if not any(c.islower() for c in v):
            raise ValueError("密码需包含至少一个小写字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码需包含至少一个数字")
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str = "user"
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("密码需包含至少一个大写字母")
        if not any(c.islower() for c in v):
            raise ValueError("密码需包含至少一个小写字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码需包含至少一个数字")
        return v


class UpdateProfileRequest(BaseModel):
    email: Optional[EmailStr] = Field(None, max_length=255)


class UserUpdateRequest(BaseModel):
    role: Optional[Literal["admin", "user"]] = None
    is_active: Optional[bool] = None


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("密码需包含至少一个大写字母")
        if not any(c.islower() for c in v):
            raise ValueError("密码需包含至少一个小写字母")
        if not any(c.isdigit() for c in v):
            raise ValueError("密码需包含至少一个数字")
        return v


class AdminUserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    collection_count: int = 0

    class Config:
        from_attributes = True
