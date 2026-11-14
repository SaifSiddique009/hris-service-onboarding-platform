from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_token
from app.modules.users.models import User, UserRole

bearer = HTTPBearer(auto_error=False)
Db = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    claims = decode_token(credentials.credentials) if credentials else None
    user = db.get(User, int(claims["sub"])) if claims else None
    # Role and active flag come from the row, never from the token.
    if not user or not user.is_active or claims["ver"] != user.token_version:
        raise Unauthorized("Not authenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    def check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise Forbidden("Your role cannot do this")
        return user

    return Depends(check)


require_admin = require_roles(UserRole.HR_ADMIN)
