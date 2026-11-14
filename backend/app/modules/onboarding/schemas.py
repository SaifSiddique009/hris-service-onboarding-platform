from datetime import date, datetime

from pydantic import BaseModel, Field

from app.core.schemas import Out
from app.modules.onboarding.models import DeadlineUnit, TaskOwnerKind, TaskStatus
from app.modules.users.schemas import DepartmentRef, UserSummary


class TemplateTaskOut(Out):
    id: int
    title: str
    description: str
    owner_kind: TaskOwnerKind
    owner_department: DepartmentRef | None
    deadline_unit: DeadlineUnit
    deadline_value: int
    deadline_label: str
    depends_on_task_id: int | None
    sort_order: int


class TemplateOut(Out):
    id: int
    name: str
    description: str
    is_active: bool
    task_count: int
    updated_at: datetime


class TemplateDetail(TemplateOut):
    tasks: list[TemplateTaskOut]


class TemplateRef(Out):
    id: int
    name: str


class TemplateCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=3, max_length=1000)


class TemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=3, max_length=120)
    description: str | None = Field(None, min_length=3, max_length=1000)
    is_active: bool | None = None


class TemplateTaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=3, max_length=2000)
    owner_kind: TaskOwnerKind
    owner_department_id: int | None = None
    deadline_unit: DeadlineUnit
    deadline_value: int = Field(ge=1, le=365)
    depends_on_task_id: int | None = None
    sort_order: int | None = None


class TemplateTaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = Field(None, min_length=3, max_length=2000)
    owner_kind: TaskOwnerKind | None = None
    owner_department_id: int | None = None
    deadline_unit: DeadlineUnit | None = None
    deadline_value: int | None = Field(None, ge=1, le=365)
    depends_on_task_id: int | None = None
    sort_order: int | None = None


class Progress(BaseModel):
    total: int
    completed: int
    in_progress: int
    not_started: int
    blocked: int
    overdue: int


class TaskRef(Out):
    id: int
    title: str
    status: TaskStatus


class TaskEventOut(Out):
    from_status: TaskStatus | None
    to_status: TaskStatus
    actor: UserSummary
    note: str | None
    created_at: datetime


class OnboardingTaskOut(Out):
    id: int
    checklist_id: int
    employee: UserSummary
    title: str
    description: str
    owner_kind: TaskOwnerKind
    owner_department: DepartmentRef | None
    assignee: UserSummary
    due_date: date
    status: TaskStatus
    effective_status: str
    is_overdue: bool
    depends_on: TaskRef | None
    completed_at: datetime | None
    allowed_actions: list[str] = []


class OnboardingTaskDetail(OnboardingTaskOut):
    history: list[TaskEventOut]


class ChecklistSummary(Out):
    id: int
    employee: UserSummary
    template: TemplateRef
    start_date: date
    progress: Progress


class ChecklistDetail(ChecklistSummary):
    tasks: list[OnboardingTaskDetail]


class ChecklistCreated(ChecklistDetail):
    warnings: list[str] = []


class ChecklistCreate(BaseModel):
    employee_id: int
    template_id: int
    start_date: date | None = None


class TaskTransitionIn(BaseModel):
    action: str


class TaskUpdate(BaseModel):
    assignee_id: int | None = None
    due_date: date | None = None
