from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, Db, require_admin, require_roles
from app.core.schemas import Page
from app.modules.users import service
from app.modules.users.models import Country, Department, EmploymentStatus, UserRole
from app.modules.users.schemas import (
    CountryOut,
    DepartmentOut,
    DepartmentUpdate,
    PasswordReset,
    UserCreate,
    UserOut,
    UserSummary,
    UserUpdate,
    UserUpdated,
)

router = APIRouter(tags=["users"])
managers_and_admins = require_roles(UserRole.MANAGER, UserRole.HR_ADMIN)


@router.get("/users", response_model=Page[UserOut], dependencies=[managers_and_admins])
def list_users(
    db: Db,
    user: CurrentUser,
    country: str | None = None,
    department_id: int | None = None,
    role: UserRole | None = None,
    status: EmploymentStatus | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    filters = {
        "is_active": is_active,
        "country": country,
        "department_id": department_id,
        "role": role,
        "status": status,
        "search": search,
    }
    items, total = service.list_users(db, user, filters, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/users/lookup", response_model=list[UserSummary], dependencies=[managers_and_admins])
def lookup_users(
    db: Db, department_id: int | None = None, search: str | None = None, managing: bool = False
):
    return service.lookup_users(db, department_id, search, managing)


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Db, user: CurrentUser):
    return service.get_visible_user(db, user, user_id)


@router.post("/users", response_model=UserOut, status_code=201, dependencies=[require_admin])
def create_user(data: UserCreate, db: Db):
    return service.create_user(db, data)


@router.patch("/users/{user_id}", response_model=UserUpdated, dependencies=[require_admin])
def update_user(user_id: int, data: UserUpdate, db: Db, actor: CurrentUser):
    user = service.update_user(db, actor, user_id, data)
    # Tells HR Admin what a deactivated person still holds: work, and people who report to them.
    left = (
        {}
        if user.is_active
        else {
            "open_items": service.open_work(db, user.id),
            "direct_reports": service.direct_reports(db, user.id),
        }
    )
    return UserUpdated.model_validate(user).model_copy(update=left)


@router.post("/users/{user_id}/password", status_code=204, dependencies=[require_admin])
def set_password(user_id: int, data: PasswordReset, db: Db, actor: CurrentUser):
    service.set_password(db, actor, user_id, data.new_password)


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Db, _: CurrentUser):
    return db.scalars(select(Department).order_by(Department.name)).all()


@router.patch(
    "/departments/{department_id}", response_model=DepartmentOut, dependencies=[require_admin]
)
def update_department(department_id: int, data: DepartmentUpdate, db: Db):
    return service.set_department_head(db, department_id, data.head_id)


@router.get("/countries", response_model=list[CountryOut])
def list_countries(db: Db, _: CurrentUser):
    return db.scalars(select(Country).order_by(Country.name)).all()
