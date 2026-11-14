from typing import Literal

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, Db
from app.core.schemas import Page
from app.modules.requests import service
from app.modules.requests.models import (
    RequestCategory,
    RequestPriority,
    RequestStatus,
    ServiceRequest,
)
from app.modules.requests.schemas import (
    AssignIn,
    CategoryOut,
    CommentIn,
    CommentOut,
    RequestCreate,
    RequestDetail,
    RequestSummary,
    TransitionIn,
)
from app.modules.users.models import User

router = APIRouter(tags=["service requests"])
View = Literal["all", "mine", "assigned", "team", "queue"]


def detail(request: ServiceRequest, user: User) -> RequestDetail:
    actions = service.actions_for(user, request)
    return RequestDetail.model_validate(request).model_copy(update={"allowed_actions": actions})


@router.get("/request-categories", response_model=list[CategoryOut])
def list_categories(db: Db, _: CurrentUser):
    return db.scalars(
        select(RequestCategory).where(RequestCategory.is_active).order_by(RequestCategory.id)
    ).all()


@router.post("/requests", response_model=RequestDetail, status_code=201)
def create_request(data: RequestCreate, db: Db, user: CurrentUser):
    return detail(service.create_request(db, user, data), user)


@router.get("/requests", response_model=Page[RequestSummary])
def list_requests(
    db: Db,
    user: CurrentUser,
    view: View = "all",
    status: RequestStatus | None = None,
    category_id: int | None = None,
    priority: RequestPriority | None = None,
    country: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    filters = {
        "status": status,
        "category_id": category_id,
        "priority": priority,
        "country": country,
        "search": search,
    }
    items, total = service.list_requests(db, user, view, filters, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/requests/{request_id}", response_model=RequestDetail)
def get_request(request_id: int, db: Db, user: CurrentUser):
    return detail(service.get_request(db, user, request_id), user)


@router.post("/requests/{request_id}/assign", response_model=RequestDetail)
def assign(request_id: int, data: AssignIn, db: Db, user: CurrentUser):
    request = service.assign(db, user, request_id, data.assignee_id, data.note, "assign")
    return detail(request, user)


@router.post("/requests/{request_id}/reassign", response_model=RequestDetail)
def reassign(request_id: int, data: AssignIn, db: Db, user: CurrentUser):
    request = service.assign(db, user, request_id, data.assignee_id, data.note, "reassign")
    return detail(request, user)


@router.post("/requests/{request_id}/transitions", response_model=RequestDetail)
def transition(request_id: int, data: TransitionIn, db: Db, user: CurrentUser):
    return detail(service.act(db, user, request_id, data.action, data.note), user)


@router.post("/requests/{request_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(request_id: int, data: CommentIn, db: Db, user: CurrentUser):
    return service.add_comment(db, user, request_id, data.body)
