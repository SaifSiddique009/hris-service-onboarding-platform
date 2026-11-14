from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased, selectinload

from app.core.errors import Conflict, Invalid, NotFound
from app.core.transitions import Action, allowed_actions, check_action
from app.modules.onboarding.models import (
    DeadlineUnit,
    OnboardingChecklist,
    OnboardingTask,
    OnboardingTaskEvent,
    OnboardingTemplate,
    OnboardingTemplateTask,
    TaskOwnerKind,
    TaskStatus,
)
from app.modules.onboarding.schemas import TaskUpdate, TemplateTaskCreate, TemplateTaskUpdate
from app.modules.users.models import Department, User, UserRole

T = TaskStatus
Employee = aliased(User)


def is_admin(user: User) -> bool:
    return user.role == UserRole.HR_ADMIN


def can_work_on(user: User, task: OnboardingTask) -> bool:
    return is_admin(user) or task.assignee_id == user.id


ACTIONS = {
    "start": Action((T.NOT_STARTED,), T.IN_PROGRESS, can_work_on),
    "complete": Action((T.NOT_STARTED, T.IN_PROGRESS), T.COMPLETED, can_work_on),
    "put_back": Action((T.IN_PROGRESS,), T.NOT_STARTED, can_work_on),
    "reopen": Action((T.COMPLETED,), T.IN_PROGRESS, can_work_on),
}


def actions_for(user: User, task: OnboardingTask) -> list[str]:
    actions = allowed_actions(ACTIONS, task, user)
    return [] if task.is_blocked else actions


def due_date(start: date, unit: DeadlineUnit, value: int) -> date:
    """Day 1 is the start date itself; week n ends on its seventh day."""
    days = value if unit == DeadlineUnit.DAY else value * 7
    return start + timedelta(days=days - 1)


# Templates


def lock_template(db: Session, template_id: int) -> OnboardingTemplate:
    """Serialises edits and copies of one template, so its dependency chain is read consistently."""
    # populate_existing: the session may already hold this template with an older task list.
    template = db.scalar(
        select(OnboardingTemplate)
        .where(OnboardingTemplate.id == template_id)
        .options(selectinload(OnboardingTemplate.tasks))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not template:
        raise NotFound("Template not found")
    return template


def create_template(db: Session, user: User, name: str, description: str) -> OnboardingTemplate:
    template = OnboardingTemplate(name=name, description=description, created_by_id=user.id)
    db.add(template)
    _commit_unique(db, "A template with this name already exists")
    return template


def update_template(db: Session, template_id: int, changes: dict) -> OnboardingTemplate:
    template = lock_template(db, template_id)
    for field, value in changes.items():
        setattr(template, field, value)
    _commit_unique(db, "A template with this name already exists")
    return template


def _commit_unique(db: Session, message: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise Conflict(message, "NAME_TAKEN") from None


def _check_template_task(db: Session, template: OnboardingTemplate, task: OnboardingTemplateTask):
    if task.owner_kind == TaskOwnerKind.LINE_MANAGER:
        task.owner_department_id = None
    elif not task.owner_department_id or not db.get(Department, task.owner_department_id):
        raise Invalid("A department task needs an owning department")

    # Follow the chain from the dependency; reaching this task again would be a loop.
    by_id = {t.id: t for t in template.tasks}
    current = task.depends_on_task_id
    while current is not None:
        if current == task.id:
            raise Conflict("This dependency would make the tasks wait on each other", "CYCLE")
        if current not in by_id:
            raise Invalid("A task can only depend on a task in the same template")
        current = by_id[current].depends_on_task_id


def add_template_task(db: Session, template_id: int, data: TemplateTaskCreate):
    template = lock_template(db, template_id)
    fields = data.model_dump()
    if fields["sort_order"] is None:
        fields["sort_order"] = max((t.sort_order for t in template.tasks), default=0) + 1
    task = OnboardingTemplateTask(template_id=template.id, **fields)
    _check_template_task(db, template, task)
    db.add(task)
    db.commit()
    return task


def update_template_task(db: Session, template_id: int, task_id: int, data: TemplateTaskUpdate):
    template = lock_template(db, template_id)
    task = next((t for t in template.tasks if t.id == task_id), None)
    if not task:
        raise NotFound("Task not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        # A null only means something for the two fields that can be cleared.
        if value is not None or field in ("depends_on_task_id", "owner_department_id"):
            setattr(task, field, value)
    _check_template_task(db, template, task)
    db.commit()
    return task


def delete_template_task(db: Session, template_id: int, task_id: int) -> None:
    template = lock_template(db, template_id)
    task = next((t for t in template.tasks if t.id == task_id), None)
    if not task:
        raise NotFound("Task not found")
    if any(t.depends_on_task_id == task.id for t in template.tasks):
        raise Conflict("Another task depends on this one", "HAS_DEPENDENTS")
    db.delete(task)
    db.commit()


# Checklists


def visible_checklists(user: User) -> Select[tuple[OnboardingChecklist]]:
    query = select(OnboardingChecklist).join(OnboardingChecklist.employee.of_type(Employee))
    if is_admin(user):
        return query
    return query.where(
        or_(OnboardingChecklist.employee_id == user.id, Employee.manager_id == user.id)
    )


def list_checklists(db: Session, user: User, state: str | None, country: str | None):
    query = visible_checklists(user).options(selectinload(OnboardingChecklist.tasks))
    if country:
        query = query.where(Employee.country_code == country.upper())
    checklists = db.scalars(query.order_by(OnboardingChecklist.start_date.desc())).all()
    if state:
        checklists = [c for c in checklists if c.is_active == (state == "active")]
    return checklists


def get_checklist(db: Session, user: User, checklist_id: int) -> OnboardingChecklist:
    checklist = db.scalar(visible_checklists(user).where(OnboardingChecklist.id == checklist_id))
    if not checklist:
        raise NotFound("Checklist not found")
    return checklist


def get_own_checklist(db: Session, user: User) -> OnboardingChecklist:
    checklist = db.scalar(
        select(OnboardingChecklist).where(OnboardingChecklist.employee_id == user.id)
    )
    if not checklist:
        raise NotFound("You have no onboarding checklist")
    return checklist


def assign_checklist(
    db: Session, admin: User, employee_id: int, template_id: int, start: date | None
) -> tuple[OnboardingChecklist, list[str]]:
    template = lock_template(db, template_id)
    employee = db.get(User, employee_id)
    if not employee:
        raise Invalid("Unknown employee")
    if not template.is_active or not template.tasks:
        raise Invalid("The template must be active and have at least one task")
    if db.scalar(
        select(OnboardingChecklist.id).where(OnboardingChecklist.employee_id == employee.id)
    ):
        raise Conflict("This employee already has an onboarding checklist", "ALREADY_ONBOARDING")

    start = start or employee.joining_date
    checklist = OnboardingChecklist(
        employee_id=employee.id, template_id=template.id, start_date=start, assigned_by_id=admin.id
    )
    db.add(checklist)
    copies: dict[int, OnboardingTask] = {}
    warnings = []
    for source in template.tasks:
        owner = (
            employee.manager
            if source.owner_kind == TaskOwnerKind.LINE_MANAGER
            else source.owner_department.head
        )
        if not owner or not owner.is_active:
            # A task is never left without an owner, and the admin is told which ones fell back.
            owner = admin
            warnings.append(f'"{source.title}" has no active owner and was assigned to you.')
        copies[source.id] = OnboardingTask(
            checklist=checklist,
            template_task_id=source.id,
            title=source.title,
            description=source.description,
            owner_kind=source.owner_kind,
            owner_department_id=source.owner_department_id,
            assignee_id=owner.id,
            due_date=due_date(start, source.deadline_unit, source.deadline_value),
            sort_order=source.sort_order,
        )
    # Setting task.checklist does not add the task to the session; without this the ids are None.
    db.add_all(copies.values())
    db.flush()
    for source in template.tasks:
        task = copies[source.id]
        if source.depends_on_task_id:
            task.depends_on_task_id = copies[source.depends_on_task_id].id
        db.add(OnboardingTaskEvent(task=task, to_status=T.NOT_STARTED, actor_id=admin.id))
    db.commit()
    return checklist, warnings


# Tasks


def my_tasks(db: Session, user: User, state: str | None) -> list[OnboardingTask]:
    query = select(OnboardingTask).where(OnboardingTask.assignee_id == user.id)
    filters = {
        "open": OnboardingTask.status != T.COMPLETED,
        "completed": OnboardingTask.status == T.COMPLETED,
        "blocked": OnboardingTask.is_blocked,
        "overdue": OnboardingTask.is_overdue,
    }
    if state:
        query = query.where(filters[state])
    return list(db.scalars(query.order_by(OnboardingTask.due_date, OnboardingTask.id)))


def get_task(db: Session, user: User, task_id: int) -> OnboardingTask:
    task = db.get(OnboardingTask, task_id)
    visible = task and (
        can_work_on(user, task)
        or db.scalar(visible_checklists(user).where(OnboardingChecklist.id == task.checklist_id))
    )
    if not visible:
        raise NotFound("Task not found")
    return task


def _lock_checklist(db: Session, task: OnboardingTask) -> None:
    """Task rules read sibling tasks, so every change in one checklist runs one at a time."""
    db.execute(
        select(OnboardingChecklist.id)
        .where(OnboardingChecklist.id == task.checklist_id)
        .with_for_update()
    )
    db.refresh(task)


def _record(db: Session, task: OnboardingTask, actor: User, previous, note: str | None = None):
    db.add(
        OnboardingTaskEvent(
            task=task, from_status=previous, to_status=task.status, actor_id=actor.id, note=note
        )
    )


def transition(db: Session, user: User, task_id: int, action_name: str) -> OnboardingTask:
    task = get_task(db, user, task_id)
    _lock_checklist(db, task)
    action = check_action(ACTIONS, action_name, task, user)

    if task.status == T.NOT_STARTED and task.depends_on_task_id:
        dependency = db.get(OnboardingTask, task.depends_on_task_id, populate_existing=True)
        if dependency.status != T.COMPLETED:
            raise Conflict(f'Blocked until "{dependency.title}" is completed', "TASK_BLOCKED")
    if action_name == "reopen":
        started = db.scalar(
            select(func.count()).where(
                OnboardingTask.depends_on_task_id == task.id, OnboardingTask.status != T.NOT_STARTED
            )
        )
        if started:
            raise Conflict(
                "A task that depends on this one has already started", "DEPENDENT_STARTED"
            )

    now = datetime.now(UTC)
    previous = task.status
    task.status = action.target
    if action.target == T.COMPLETED:
        task.started_at = task.started_at or now
        task.completed_at, task.completed_by_id = now, user.id
    elif action.target == T.IN_PROGRESS:
        task.started_at = task.started_at or now
        task.completed_at = task.completed_by_id = None
    else:
        task.started_at = None
    _record(db, task, user, previous)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, admin: User, task_id: int, data: TaskUpdate) -> OnboardingTask:
    task = get_task(db, admin, task_id)
    _lock_checklist(db, task)
    if data.assignee_id is not None and data.assignee_id != task.assignee_id:
        assignee = db.get(User, data.assignee_id)
        if not assignee or not assignee.is_active:
            raise Invalid("The assignee must be an active user")
        note = f"Reassigned from {task.assignee.full_name} to {assignee.full_name}"
        task.assignee = assignee
        _record(db, task, admin, task.status, note)
    if data.due_date is not None and data.due_date != task.due_date:
        note = f"Due date changed from {task.due_date} to {data.due_date}"
        task.due_date = data.due_date
        _record(db, task, admin, task.status, note)
    db.commit()
    db.refresh(task)
    return task


def count_open_assigned(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).where(
            OnboardingTask.assignee_id == user_id, OnboardingTask.status != T.COMPLETED
        )
    )
