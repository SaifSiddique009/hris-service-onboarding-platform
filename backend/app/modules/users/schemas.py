from datetime import date
from typing import Annotated

from pydantic import AfterValidator, ConfigDict, Field, StringConstraints

from app.core.schemas import In, Out, PlausibleDate
from app.core.security import MAX_PASSWORD_BYTES
from app.modules.users.models import EmploymentStatus, UserRole

EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def _acceptable(value: str) -> str:
    if len(value.encode()) > MAX_PASSWORD_BYTES:
        raise ValueError("Password is too long")
    if value != value.strip():
        raise ValueError("Password cannot start or end with a space")
    if not (any(c.isalpha() for c in value) and any(c.isdigit() for c in value)):
        raise ValueError("Password needs at least one letter and one number")
    return value


Password = Annotated[
    str,
    StringConstraints(strip_whitespace=False, min_length=8, max_length=72),
    AfterValidator(_acceptable),
]


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
    direct_reports: int = 0


class DepartmentOut(DepartmentRef):
    head: UserSummary | None


class UserCreate(In):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(pattern=EMAIL, max_length=200)
    password: Password
    job_title: str = Field(min_length=2, max_length=120)
    role: UserRole
    country: str = Field(min_length=2, max_length=2)
    department_id: int
    manager_id: int | None = None
    status: EmploymentStatus
    joining_date: PlausibleDate


class UserUpdate(In):
    # Email and password are not editable here; saying "saved" for them would mislead.
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: str | None = Field(None, min_length=2, max_length=120)
    job_title: str | None = Field(None, min_length=2, max_length=120)
    role: UserRole | None = None
    country: str | None = Field(None, min_length=2, max_length=2)
    department_id: int | None = None
    manager_id: int | None = None
    status: EmploymentStatus | None = None
    joining_date: PlausibleDate | None = None
    is_active: bool | None = None


class PasswordReset(In):
    new_password: Password


class DepartmentUpdate(In):
    head_id: int | None
