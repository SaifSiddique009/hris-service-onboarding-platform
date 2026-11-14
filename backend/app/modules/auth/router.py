from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, Db
from app.core.errors import Invalid, Unauthorized
from app.core.schemas import In
from app.core.security import create_token, hash_password, verify_password
from app.modules.requests import service as requests
from app.modules.users.models import User
from app.modules.users.schemas import EMAIL, Password, UserOut

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
    return _session(user)


def _session(user: User) -> dict:
    return {
        "access_token": create_token(user.id, user.token_version),
        "expires_in": settings.jwt_expires_minutes * 60,
        "user": user,
    }


class PasswordChange(In):
    current_password: Annotated[str, StringConstraints(strip_whitespace=False)]
    new_password: Password


@router.post("/password", response_model=LoginOut)
def change_password(data: PasswordChange, db: Db, user: CurrentUser):
    problem = None
    if not verify_password(data.current_password, user.password_hash):
        problem = ("current_password", "Current password is not correct")
    elif data.new_password == data.current_password:
        problem = ("new_password", "The new password must differ from the current one")
    if problem:
        raise Invalid(problem[1], details={"fields": {problem[0]: problem[1]}})
    user.password_hash = hash_password(data.new_password)
    # Signs out every other session; the reply carries a token for this one.
    user.token_version += 1
    db.commit()
    return _session(user)


class ForgotIn(In):
    email: str = Field(pattern=EMAIL, max_length=200)


@router.post("/forgot-password")
def forgot_password(data: ForgotIn, db: Db):
    user = db.scalar(select(User).where(User.email == data.email.lower(), User.is_active))
    if user:
        requests.request_password_reset(db, user)
    # The same reply either way, so it does not reveal which emails have an account.
    return {
        "message": "If this email has an account, HR has been asked to set a new password "
        "and will contact you."
    }


@router.post("/logout", status_code=204)
def logout(db: Db, user: CurrentUser):
    user.token_version += 1
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
