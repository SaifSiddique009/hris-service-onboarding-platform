from datetime import UTC, datetime

from sqlalchemy import Select, and_, false, func, or_, select, true
from sqlalchemy.orm import Session, aliased, selectinload

from app.core.errors import Conflict, Invalid, NotFound
from app.core.schemas import contains
from app.core.transitions import Action, allowed_actions, check_action
from app.modules.requests.models import (
    ClosureReason,
    RequestAssignment,
    RequestCategory,
    RequestComment,
    RequestStatus,
    RequestStatusEvent,
    ServiceRequest,
)
from app.modules.requests.schemas import RequestCreate
from app.modules.users.models import User, UserRole

S = RequestStatus
UNRESOLVED = (S.SUBMITTED, S.ASSIGNED, S.IN_PROGRESS)
OPEN = (*UNRESOLVED, S.RESOLVED)
Requester = aliased(User)


def is_admin(user: User) -> bool:
    return user.role == UserRole.HR_ADMIN


def is_requester(user: User, request: ServiceRequest) -> bool:
    return request.requester_id == user.id


def is_assignee(user: User, request: ServiceRequest) -> bool:
    return request.assignee_id == user.id


def is_triager(user: User, request: ServiceRequest) -> bool:
    if is_admin(user):
        return True
    if request.category.is_confidential:
        return False
    owns_category = (
        user.role == UserRole.MANAGER
        and request.category.owning_department_id == user.department_id
    )
    return request.requester.manager_id == user.id or owns_category


ACTIONS = {
    "assign": Action((S.SUBMITTED,), S.ASSIGNED, is_triager),
    "reassign": Action((S.ASSIGNED, S.IN_PROGRESS), S.ASSIGNED, is_triager),
    "withdraw": Action((S.SUBMITTED,), S.CLOSED, is_requester),
    "reject": Action(
        (S.SUBMITTED, S.ASSIGNED), S.CLOSED, lambda u, r: is_triager(u, r) or is_assignee(u, r)
    ),
    "start": Action((S.ASSIGNED,), S.IN_PROGRESS, is_assignee),
    "resolve": Action((S.IN_PROGRESS,), S.RESOLVED, is_assignee),
    "reopen": Action((S.RESOLVED,), S.IN_PROGRESS, is_requester),
    "close": Action((S.RESOLVED,), S.CLOSED, lambda u, r: is_requester(u, r) or is_admin(u)),
}
NOTE_REQUIRED = {"reject", "resolve", "reopen"}
CLOSURE_REASONS = {
    "withdraw": ClosureReason.WITHDRAWN,
    "reject": ClosureReason.REJECTED,
    "close": ClosureReason.COMPLETED,
}


def _scopes(user: User) -> dict:
    # HR Admin sees confidential requests in every view; nobody else does through team or queue.
    not_confidential = true() if is_admin(user) else ~RequestCategory.is_confidential
    owns_queue = RequestCategory.owning_department_id == user.department_id
    if is_admin(user):
        queue = owns_queue
    elif user.role == UserRole.MANAGER:
        queue = and_(not_confidential, owns_queue)
    else:
        queue = false()
    return {
        "mine": ServiceRequest.requester_id == user.id,
        "assigned": ServiceRequest.assignee_id == user.id,
        "team": and_(not_confidential, Requester.manager_id == user.id),
        "queue": queue,
    }


def visible_requests(user: User, view: str = "all") -> Select[tuple[ServiceRequest]]:
    scopes = _scopes(user)
    visible = true() if is_admin(user) else or_(*scopes.values())
    query = (
        select(ServiceRequest)
        .join(ServiceRequest.category)
        .join(ServiceRequest.requester.of_type(Requester))
        .where(visible)
    )
    return query if view == "all" else query.where(scopes[view])


def list_requests(db: Session, user: User, view: str, filters: dict, page: int, page_size: int):
    query = visible_requests(user, view)
    for column in ("status", "category_id", "priority"):
        if filters.get(column) is not None:
            query = query.where(getattr(ServiceRequest, column) == filters[column])
    if filters.get("country"):
        query = query.where(Requester.country_code == filters["country"].upper())
    if filters.get("search"):
        query = query.where(contains(ServiceRequest.title, filters["search"]))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    people = [
        selectinload(relation).options(selectinload(User.department), selectinload(User.country))
        for relation in (ServiceRequest.requester, ServiceRequest.assignee)
    ]
    rows = db.scalars(
        query.options(selectinload(ServiceRequest.category), *people)
        .order_by(ServiceRequest.created_at.desc(), ServiceRequest.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return rows, total


def get_request(db: Session, user: User, request_id: int, lock: bool = False) -> ServiceRequest:
    query = visible_requests(user).where(ServiceRequest.id == request_id)
    if lock:
        # Re-read after locking, in case this session loaded the row earlier.
        query = query.with_for_update(of=ServiceRequest).execution_options(populate_existing=True)
    request = db.scalar(query)
    if not request:
        raise NotFound("Request not found")
    return request


def actions_for(user: User, request: ServiceRequest) -> list[str]:
    actions = allowed_actions(ACTIONS, request, user)
    return actions if request.status == S.CLOSED else [*actions, "comment"]


def _record(db: Session, request: ServiceRequest, actor: User, previous, note: str | None) -> None:
    db.add(
        RequestStatusEvent(
            request=request,
            from_status=previous,
            to_status=request.status,
            actor_id=actor.id,
            note=note,
        )
    )


def create_request(db: Session, user: User, data: RequestCreate) -> ServiceRequest:
    category = db.get(RequestCategory, data.category_id)
    if not category or not category.is_active:
        raise Invalid("Unknown category")
    request = ServiceRequest(**data.model_dump(), requester_id=user.id, status=S.SUBMITTED)
    db.add(request)
    _record(db, request, user, None, None)
    db.commit()
    return request


def assign(
    db: Session, user: User, request_id: int, assignee_id: int, note: str | None, action: str
) -> ServiceRequest:
    request = get_request(db, user, request_id, lock=True)
    if action == "assign" and request.assignee and is_triager(user, request):
        holder = request.assignee.full_name
        raise Conflict(f"This request was already assigned to {holder}", "ALREADY_ASSIGNED")
    check_action(ACTIONS, action, request, user)

    assignee = db.get(User, assignee_id)
    if not assignee or not assignee.is_active:
        raise Invalid("The assignee must be an active user")
    if assignee.id == request.requester_id:
        raise Invalid("A request cannot be assigned to the person who raised it")
    if request.category.is_confidential and assignee.id == request.requester.manager_id:
        raise Invalid("A confidential request cannot be assigned to the requester's manager")

    previous = request.status
    request.status, request.assignee = S.ASSIGNED, assignee
    db.add(
        RequestAssignment(
            request=request, assignee_id=assignee.id, assigned_by_id=user.id, note=note
        )
    )
    _record(db, request, user, previous, note)
    db.commit()
    return request


def act(
    db: Session, user: User, request_id: int, action_name: str, note: str | None
) -> ServiceRequest:
    request = get_request(db, user, request_id, lock=True)
    if action_name in ("assign", "reassign"):
        raise Invalid("Use the assign endpoints to choose an assignee")
    action = check_action(ACTIONS, action_name, request, user)
    if action_name in NOTE_REQUIRED and not (note and note.strip()):
        raise Invalid("A note is required for this action")

    now = datetime.now(UTC)
    previous = request.status
    request.status = action.target
    if action.target == S.RESOLVED:
        request.resolved_at = now
    if action_name == "reopen":
        request.resolved_at = None
    if action.target == S.CLOSED:
        request.closed_at, request.closure_reason = now, CLOSURE_REASONS[action_name]
    _record(db, request, user, previous, note)
    db.commit()
    return request


def add_comment(db: Session, user: User, request_id: int, body: str) -> RequestComment:
    # Locked so a comment cannot land on a request that closes at the same moment.
    request = get_request(db, user, request_id, lock=True)
    if request.status == S.CLOSED:
        raise Conflict("A closed request cannot receive comments", "REQUEST_CLOSED")
    comment = RequestComment(request=request, author_id=user.id, body=body.strip())
    db.add(comment)
    db.commit()
    return comment


def holds_confidential_request_from(db: Session, assignee_id: int, requester_id: int) -> bool:
    """True while this person is the assignee of an open confidential request from that employee."""
    return bool(
        db.scalar(
            select(func.count())
            .select_from(ServiceRequest)
            .join(ServiceRequest.category)
            .where(
                RequestCategory.is_confidential,
                ServiceRequest.assignee_id == assignee_id,
                ServiceRequest.requester_id == requester_id,
                ServiceRequest.status.in_(OPEN),
            )
        )
    )


def count_open_assigned(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).where(
            ServiceRequest.assignee_id == user_id, ServiceRequest.status.in_(UNRESOLVED)
        )
    )
