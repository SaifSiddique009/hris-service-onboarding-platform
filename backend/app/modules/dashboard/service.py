"""Read-only reports across both modules. The dashboard and the AI tools call these same functions,
so a term such as "open" or "overdue" has one definition."""

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.core.errors import Invalid
from app.modules.onboarding.models import OnboardingChecklist, OnboardingTask, TaskStatus
from app.modules.requests.models import RequestCategory, RequestStatus, ServiceRequest
from app.modules.requests.service import OPEN, UNRESOLVED
from app.modules.users.models import Country, Department, User

REQUEST_STATES = {
    "unresolved": UNRESOLVED,
    "awaiting_confirmation": (RequestStatus.RESOLVED,),
    "open": OPEN,
    "closed": (RequestStatus.CLOSED,),
}
Requester = aliased(User)
Hire = aliased(User)
INCOMPLETE = OnboardingTask.status != TaskStatus.COMPLETED


def _grouped(db: Session, query: Select, label) -> list[dict]:
    """A count per label, largest first."""
    rows = db.execute(
        query.with_only_columns(label, func.count())
        .group_by(label)
        .order_by(func.count().desc(), label)
    ).all()
    return [{"label": getattr(key, "value", key), "count": count} for key, count in rows]


def _count(db: Session, query: Select) -> int:
    return db.scalar(query.with_only_columns(func.count()))


def _pick(groups: dict, group_by: str | None):
    if group_by is not None and group_by not in groups:
        raise Invalid(f"group_by must be one of: {', '.join(groups)}")
    return groups.get(group_by)


def _country(value: str | None):
    """Accepts a country code or name."""
    if value is None:
        return None
    return func.lower(value).in_([func.lower(Country.code), func.lower(Country.name)])


# Employees


def count_employees(
    db: Session, country=None, department=None, role=None, status=None, group_by=None
) -> dict:
    query = select(User).join(User.department).join(User.country).where(User.is_active)
    if country:
        query = query.where(_country(country))
    if department:
        query = query.where(func.lower(Department.name) == department.lower())
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(User.status == status)
    label = _pick(
        {
            "country": Country.name,
            "department": Department.name,
            "role": User.role,
            "status": User.status,
        },
        group_by,
    )
    result = {"total": _count(db, query)}
    if label is not None:
        result["groups"] = _grouped(db, query, label)
    return result


# Service requests


def _requests(state=None, status=None, category=None, priority=None, country=None) -> Select:
    if state is not None and state not in REQUEST_STATES:
        raise Invalid(f"state must be one of: {', '.join(REQUEST_STATES)}")
    query = (
        select(ServiceRequest)
        .join(ServiceRequest.category)
        .join(ServiceRequest.requester.of_type(Requester))
        .join(Country, Requester.country_code == Country.code)
    )
    if state:
        query = query.where(ServiceRequest.status.in_(REQUEST_STATES[state]))
    if status:
        query = query.where(ServiceRequest.status == status)
    if category:
        query = query.where(func.lower(RequestCategory.name) == category.lower())
    if priority:
        query = query.where(ServiceRequest.priority == priority)
    if country:
        query = query.where(_country(country))
    return query


def count_service_requests(db: Session, group_by=None, **filters) -> dict:
    query = _requests(**filters)
    label = _pick(
        {
            "status": ServiceRequest.status,
            "category": RequestCategory.name,
            "priority": ServiceRequest.priority,
            "country": Country.name,
        },
        group_by,
    )
    result = {"total": _count(db, query)}
    if label is not None:
        result["groups"] = _grouped(db, query, label)
    return result


def list_service_requests(db: Session, limit: int = 20, **filters) -> list[dict]:
    query = (
        _requests(**filters)
        .options(
            selectinload(ServiceRequest.category),
            selectinload(ServiceRequest.requester).selectinload(User.country),
            selectinload(ServiceRequest.assignee),
        )
        .order_by(ServiceRequest.created_at.desc())
        .limit(min(limit, 20))
    )
    return [request_row(request) for request in db.scalars(query)]


def request_row(request: ServiceRequest) -> dict:
    """The fields that may leave the platform. A confidential request keeps its title private."""
    return {
        "reference": f"REQ-{request.id:04d}",
        "title": None if request.category.is_confidential else request.title,
        "category": request.category.name,
        "status": request.status.value,
        "priority": request.priority.value,
        "requester": request.requester.full_name,
        "country": request.requester.country.name,
        "assignee": request.assignee.full_name if request.assignee else None,
        "created": request.created_at.date().isoformat(),
    }


# Onboarding


def _checklists(country=None) -> Select:
    query = (
        select(OnboardingChecklist)
        .join(OnboardingChecklist.employee.of_type(Hire))
        .join(Country, Hire.country_code == Country.code)
        .options(
            selectinload(OnboardingChecklist.tasks),
            selectinload(OnboardingChecklist.employee).options(
                selectinload(User.country), selectinload(User.department)
            ),
        )
    )
    return query.where(_country(country)) if country else query


def onboarding_progress(db: Session, country=None, active_only=False) -> list[dict]:
    checklists = db.scalars(_checklists(country).order_by(OnboardingChecklist.start_date.desc()))
    return [
        {
            "new_hire": checklist.employee.full_name,
            "country": checklist.employee.country.name,
            "department": checklist.employee.department.name,
            "start_date": checklist.start_date.isoformat(),
            **checklist.progress,
        }
        for checklist in checklists
        if checklist.is_active or not active_only
    ]


TASK_STATES = {
    "overdue": OnboardingTask.is_overdue,
    "blocked": OnboardingTask.is_blocked,
    "in_progress": OnboardingTask.status == TaskStatus.IN_PROGRESS,
    "not_started": OnboardingTask.status == TaskStatus.NOT_STARTED,
    "completed": OnboardingTask.status == TaskStatus.COMPLETED,
}


def list_onboarding_tasks(
    db: Session, state: str, country=None, department=None, limit: int = 20
) -> list[dict]:
    if state not in TASK_STATES:
        raise Invalid(f"state must be one of: {', '.join(TASK_STATES)}")
    query = (
        select(OnboardingTask)
        .join(OnboardingTask.checklist)
        .join(OnboardingChecklist.employee.of_type(Hire))
        .join(Country, Hire.country_code == Country.code)
        .outerjoin(OnboardingTask.owner_department)
        .where(TASK_STATES[state])
    )
    if country:
        query = query.where(_country(country))
    if department:
        query = query.where(func.lower(Department.name) == department.lower())
    tasks = db.scalars(query.order_by(OnboardingTask.due_date).limit(min(limit, 20)))
    return [
        {
            "new_hire": task.employee.full_name,
            "country": task.employee.country.name,
            "task": task.title,
            "owner": task.owner_department.name if task.owner_department else "Line manager",
            "assignee": task.assignee.full_name,
            "due_date": task.due_date.isoformat(),
            "status": task.effective_status,
            "overdue": task.is_overdue,
        }
        for task in tasks
    ]


def onboarding_summary(db: Session) -> dict:
    checklists = db.scalars(_checklists()).all()
    active = sum(checklist.is_active for checklist in checklists)
    return {
        "active_new_hires": active,
        "completed_new_hires": len(checklists) - active,
        "overdue_tasks": _count(db, select(OnboardingTask).where(OnboardingTask.is_overdue)),
        "blocked_tasks": _count(db, select(OnboardingTask).where(OnboardingTask.is_blocked)),
    }


def onboarding_completion_by_country(db: Session) -> list[dict]:
    completed = func.count().filter(OnboardingTask.status == TaskStatus.COMPLETED)
    rows = db.execute(
        select(Country.name, func.count(), completed)
        .select_from(OnboardingTask)
        .join(OnboardingTask.checklist)
        .join(OnboardingChecklist.employee.of_type(Hire))
        .join(Country, Hire.country_code == Country.code)
        .group_by(Country.name)
        .order_by(Country.name)
    ).all()
    return [
        {
            "country": name,
            "total_tasks": total,
            "completed_tasks": done,
            "rate": round(done / total, 2),
        }
        for name, total, done in rows
    ]


# Cross-module


def new_hires_with_open_requests(db: Session, category=None) -> list[dict]:
    """New hires still in onboarding who are waiting on a service request."""
    in_onboarding = select(OnboardingTask.checklist_id).where(INCOMPLETE)
    hires = select(OnboardingChecklist.employee_id).where(OnboardingChecklist.id.in_(in_onboarding))
    query = (
        _requests(state="open", category=category)
        .where(ServiceRequest.requester_id.in_(hires))
        .options(
            selectinload(ServiceRequest.category),
            selectinload(ServiceRequest.requester).selectinload(User.country),
            selectinload(ServiceRequest.assignee),
        )
        .order_by(Requester.full_name, ServiceRequest.created_at)
    )
    by_hire: dict[str, dict] = {}
    for request in db.scalars(query):
        hire = request.requester
        entry = by_hire.setdefault(
            hire.full_name,
            {"new_hire": hire.full_name, "country": hire.country.name, "open_requests": []},
        )
        entry["open_requests"].append(request_row(request))
    return list(by_hire.values())


def work_held_by_inactive_users(db: Session) -> dict:
    inactive = select(User.id).where(~User.is_active)
    return {
        "requests": _count(
            db,
            select(ServiceRequest).where(
                ServiceRequest.status.in_(UNRESOLVED), ServiceRequest.assignee_id.in_(inactive)
            ),
        ),
        "onboarding_tasks": _count(
            db, select(OnboardingTask).where(INCOMPLETE, OnboardingTask.assignee_id.in_(inactive))
        ),
    }
