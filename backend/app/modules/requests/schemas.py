from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, computed_field

from app.core.schemas import Out
from app.modules.requests.models import ClosureReason, RequestPriority, RequestStatus
from app.modules.users.schemas import DepartmentRef, UserSummary


class CategoryRef(Out):
    id: int
    name: str


class CategoryOut(CategoryRef):
    description: str
    owning_department: DepartmentRef | None
    is_confidential: bool


class StatusEventOut(Out):
    from_status: RequestStatus | None
    to_status: RequestStatus
    actor: UserSummary
    note: str | None
    created_at: datetime


class AssignmentOut(Out):
    assignee: UserSummary
    assigned_by: UserSummary
    note: str | None
    created_at: datetime


class CommentOut(Out):
    id: int
    author: UserSummary
    body: str
    created_at: datetime


class RequestSummary(Out):
    id: int
    title: str
    category: CategoryRef
    priority: RequestPriority
    status: RequestStatus
    closure_reason: ClosureReason | None
    requester: UserSummary
    assignee: UserSummary | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def reference(self) -> str:
        return f"REQ-{self.id:04d}"


class RequestDetail(RequestSummary):
    description: str
    resolved_at: datetime | None
    closed_at: datetime | None
    history: list[StatusEventOut]
    assignments: list[AssignmentOut]
    comments: list[CommentOut]
    allowed_actions: list[str] = []


class RequestCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=3, max_length=4000)
    category_id: int
    priority: RequestPriority


class AssignIn(BaseModel):
    assignee_id: int
    note: str | None = Field(None, max_length=1000)


class TransitionIn(BaseModel):
    action: str
    note: str | None = Field(None, max_length=1000)


class CommentIn(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
