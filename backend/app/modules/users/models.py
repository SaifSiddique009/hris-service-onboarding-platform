import enum
from datetime import date, datetime

from sqlalchemy import CHAR, CheckConstraint, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class UserRole(enum.StrEnum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    HR_ADMIN = "HR_ADMIN"


class EmploymentStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    ON_PROBATION = "ON_PROBATION"
    ON_NOTICE = "ON_NOTICE"


class Country(Base):
    __tablename__ = "countries"

    code: Mapped[str] = mapped_column(CHAR(2), primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    timezone: Mapped[str] = mapped_column(Text)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    head_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", use_alter=True))

    head: Mapped["User | None"] = relationship(foreign_keys=[head_id], post_update=True)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("manager_id <> id", name="not_own_manager"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(Text)
    job_title: Mapped[str] = mapped_column(Text)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    country_code: Mapped[str] = mapped_column(ForeignKey("countries.code"), index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), index=True)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[EmploymentStatus] = mapped_column(
        Enum(EmploymentStatus, name="employment_status")
    )
    joining_date: Mapped[date]
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    token_version: Mapped[int] = mapped_column(default=0, server_default="0")
    last_login_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    country: Mapped[Country] = relationship()
    department: Mapped[Department] = relationship(foreign_keys=[department_id])
    manager: Mapped["User | None"] = relationship(remote_side=[id])
