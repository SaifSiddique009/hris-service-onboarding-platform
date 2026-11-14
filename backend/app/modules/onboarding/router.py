from typing import Literal

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, Db, require_admin
from app.modules.onboarding import service
from app.modules.onboarding.models import OnboardingChecklist, OnboardingTask, OnboardingTemplate
from app.modules.onboarding.schemas import (
    ChecklistCreate,
    ChecklistCreated,
    ChecklistDetail,
    ChecklistSummary,
    OnboardingTaskOut,
    TaskTransitionIn,
    TaskUpdate,
    TemplateCreate,
    TemplateDetail,
    TemplateOut,
    TemplateTaskCreate,
    TemplateTaskOut,
    TemplateTaskUpdate,
    TemplateUpdate,
)
from app.modules.users.models import User

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
templates = APIRouter(prefix="/templates", dependencies=[require_admin])


def task_out(task: OnboardingTask, user: User) -> OnboardingTaskOut:
    actions = service.actions_for(user, task)
    return OnboardingTaskOut.model_validate(task).model_copy(update={"allowed_actions": actions})


def checklist_out(checklist: OnboardingChecklist, user: User, warnings=()) -> ChecklistCreated:
    detail = ChecklistCreated.model_validate(checklist)
    for out, task in zip(detail.tasks, checklist.tasks, strict=True):
        out.allowed_actions = service.actions_for(user, task)
    detail.warnings = list(warnings)
    return detail


@templates.get("", response_model=list[TemplateOut])
def list_templates(db: Db):
    return db.scalars(select(OnboardingTemplate).order_by(OnboardingTemplate.name)).all()


@templates.post("", response_model=TemplateDetail, status_code=201)
def create_template(data: TemplateCreate, db: Db, user: CurrentUser):
    return service.create_template(db, user, data.name, data.description)


@templates.get("/{template_id}", response_model=TemplateDetail)
def get_template(template_id: int, db: Db):
    return service.lock_template(db, template_id)


@templates.patch("/{template_id}", response_model=TemplateDetail)
def update_template(template_id: int, data: TemplateUpdate, db: Db):
    return service.update_template(db, template_id, data.model_dump(exclude_none=True))


@templates.post("/{template_id}/tasks", response_model=TemplateTaskOut, status_code=201)
def add_template_task(template_id: int, data: TemplateTaskCreate, db: Db):
    return service.add_template_task(db, template_id, data)


@templates.patch("/{template_id}/tasks/{task_id}", response_model=TemplateTaskOut)
def update_template_task(template_id: int, task_id: int, data: TemplateTaskUpdate, db: Db):
    return service.update_template_task(db, template_id, task_id, data)


@templates.delete("/{template_id}/tasks/{task_id}", status_code=204)
def delete_template_task(template_id: int, task_id: int, db: Db):
    service.delete_template_task(db, template_id, task_id)


router.include_router(templates)


@router.post(
    "/checklists", response_model=ChecklistCreated, status_code=201, dependencies=[require_admin]
)
def assign_checklist(data: ChecklistCreate, db: Db, user: CurrentUser):
    checklist, warnings = service.assign_checklist(
        db, user, data.employee_id, data.template_id, data.start_date
    )
    return checklist_out(checklist, user, warnings)


@router.get("/checklists", response_model=list[ChecklistSummary])
def list_checklists(
    db: Db,
    user: CurrentUser,
    state: Literal["active", "completed"] | None = None,
    country: str | None = None,
):
    return service.list_checklists(db, user, state, country)


@router.get("/checklists/me", response_model=ChecklistDetail)
def my_checklist(db: Db, user: CurrentUser):
    return checklist_out(service.get_own_checklist(db, user), user)


@router.get("/checklists/{checklist_id}", response_model=ChecklistDetail)
def get_checklist(checklist_id: int, db: Db, user: CurrentUser):
    return checklist_out(service.get_checklist(db, user, checklist_id), user)


@router.get("/tasks/mine", response_model=list[OnboardingTaskOut])
def my_tasks(
    db: Db,
    user: CurrentUser,
    state: Literal["open", "blocked", "overdue", "completed"] | None = None,
):
    return [task_out(task, user) for task in service.my_tasks(db, user, state)]


@router.post("/tasks/{task_id}/transitions", response_model=OnboardingTaskOut)
def transition(task_id: int, data: TaskTransitionIn, db: Db, user: CurrentUser):
    return task_out(service.transition(db, user, task_id, data.action), user)


@router.patch("/tasks/{task_id}", response_model=OnboardingTaskOut, dependencies=[require_admin])
def update_task(task_id: int, data: TaskUpdate, db: Db, user: CurrentUser):
    return task_out(service.update_task(db, user, task_id, data), user)
