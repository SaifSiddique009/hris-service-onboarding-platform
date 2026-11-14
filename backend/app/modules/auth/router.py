from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, Db
from app.core.errors import Unauthorized
from app.core.security import create_token, verify_password
from app.modules.users.models import User
from app.modules.users.schemas import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, db: Db):
    user = db.scalar(select(User).where(User.email == data.email.strip().lower()))
    # One message for every failure, so the response does not reveal which emails exist.
    password_ok = verify_password(data.password, user.password_hash if user else None)
    if not user or not user.is_active or not password_ok:
        raise Unauthorized("Incorrect email or password", "INVALID_CREDENTIALS")
    user.last_login_at = datetime.now(UTC)
    db.commit()
    return {
        "access_token": create_token(user.id, user.token_version),
        "expires_in": settings.jwt_expires_minutes * 60,
        "user": user,
    }


@router.post("/logout", status_code=204)
def logout(db: Db, user: CurrentUser):
    user.token_version += 1
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
