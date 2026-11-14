from datetime import date
from typing import Annotated

from pydantic import Field, StringConstraints, field_validator

from app.core.schemas import In, Out
from app.core.security import MAX_PASSWORD_BYTES
from app.modules.users.models import EmploymentStatus, UserRole

EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class CountryOut(Out):
    code: str
    name: str


class DepartmentRef(Out):
    id: int
    name: str


class UserSummary(Out):
    id: int
    full_name: str
    job_title: str
    department: DepartmentRef
    country: CountryOut
    role: UserRole


class UserOut(UserSummary):
    email: str
    status: EmploymentStatus
    joining_date: date
    manager: UserSummary | None
    is_active: bool


class UserUpdated(UserOut):
    open_items: int = 0


class DepartmentOut(DepartmentRef):
    head: UserSummary | None


class UserCreate(In):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(pattern=EMAIL, max_length=200)
    password: Annotated[str, StringConstraints(strip_whitespace=False, min_length=8, max_length=72)]
    job_title: str = Field(min_length=2, max_length=120)
    role: UserRole
    country: str = Field(min_length=2, max_length=2)
    department_id: int
    manager_id: int | None = None
    status: EmploymentStatus
    joining_date: date

    @field_validator("password")
    @classmethod
    def acceptable_password(cls, value: str) -> str:
        if len(value.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError("Password is too long")
        if value != value.strip():
            raise ValueError("Password cannot start or end with a space")
        if not (any(c.isalpha() for c in value) and any(c.isdigit() for c in value)):
            raise ValueError("Password needs at least one letter and one number")
        return value


class UserUpdate(In):
    full_name: str | None = Field(None, min_length=2, max_length=120)
    job_title: str | None = Field(None, min_length=2, max_length=120)
    role: UserRole | None = None
    country: str | None = Field(None, min_length=2, max_length=2)
    department_id: int | None = None
    manager_id: int | None = None
    status: EmploymentStatus | None = None
    joining_date: date | None = None
    is_active: bool | None = None


class DepartmentUpdate(In):
    head_id: int | None
