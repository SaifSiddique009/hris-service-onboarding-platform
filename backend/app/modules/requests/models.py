import enum
from datetime import datetime

from sqlalchemy import CheckConstraint, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.modules.users.models import Department, User


class RequestPriority(enum.StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class RequestStatus(enum.StrEnum):
    SUBMITTED = "SUBMITTED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class ClosureReason(enum.StrEnum):
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


status_enum = Enum(RequestStatus, name="request_status")


class RequestCategory(Base):
    __tablename__ = "request_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    description: Mapped[str] = mapped_column(Text)
    owning_department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    is_confidential: Mapped[bool] = mapped_column(default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")

    owning_department: Mapped[Department | None] = relationship()


class ServiceRequest(Base):
    __tablename__ = "service_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('SUBMITTED', 'CLOSED') OR assignee_id IS NOT NULL",
            name="assignee_when_in_work",
        ),
        CheckConstraint(
            "(status = 'CLOSED') = (closure_reason IS NOT NULL)", name="closure_reason_iff_closed"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    category_id: Mapped[int] = mapped_column(ForeignKey("request_categories.id"), index=True)
    priority: Mapped[RequestPriority] = mapped_column(
        Enum(RequestPriority, name="request_priority")
    )
    status: Mapped[RequestStatus] = mapped_column(
        status_enum, default=RequestStatus.SUBMITTED, index=True
    )
    closure_reason: Mapped[ClosureReason | None] = mapped_column(
        Enum(ClosureReason, name="closure_reason")
    )
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    resolved_at: Mapped[datetime | None]
    closed_at: Mapped[datetime | None]

    category: Mapped[RequestCategory] = relationship()
    requester: Mapped[User] = relationship(foreign_keys=[requester_id])
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id])
    history: Mapped[list["RequestStatusEvent"]] = relationship(
        order_by="RequestStatusEvent.id", back_populates="request"
    )
    assignments: Mapped[list["RequestAssignment"]] = relationship(
        order_by="RequestAssignment.id", back_populates="request"
    )
    comments: Mapped[list["RequestComment"]] = relationship(
        order_by="RequestComment.id", back_populates="request"
    )


class RequestAssignment(Base):
    __tablename__ = "request_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), index=True)
    assignee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assigned_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    request: Mapped[ServiceRequest] = relationship(back_populates="assignments")
    assignee: Mapped[User] = relationship(foreign_keys=[assignee_id])
    assigned_by: Mapped[User] = relationship(foreign_keys=[assigned_by_id])


class RequestStatusEvent(Base):
    __tablename__ = "request_status_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), index=True)
    from_status: Mapped[RequestStatus | None] = mapped_column(status_enum)
    to_status: Mapped[RequestStatus] = mapped_column(status_enum)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # Set on an assign or reassign: who received the request.
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    request: Mapped[ServiceRequest] = relationship(back_populates="history")
    actor: Mapped[User] = relationship(foreign_keys=[actor_id])
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id])


class RequestComment(Base):
    __tablename__ = "request_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    request: Mapped[ServiceRequest] = relationship(back_populates="comments")
    author: Mapped[User] = relationship()
