from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, Invalid, NotFound
from app.core.schemas import contains
from app.core.security import hash_password
from app.modules.onboarding import service as onboarding
from app.modules.requests import service as requests
from app.modules.users.models import Country, Department, User, UserRole
from app.modules.users.schemas import UserCreate, UserUpdate

MANAGING_ROLES = (UserRole.MANAGER, UserRole.HR_ADMIN)
REPORTING_LINE_LOCK = 7001


def visible_users(user: User) -> Select[tuple[User]]:
    query = select(User)
    if user.role == UserRole.HR_ADMIN:
        return query
    return query.where(or_(User.manager_id == user.id, User.id == user.id))


def get_visible_user(db: Session, viewer: User, user_id: int) -> User:
    found = db.scalar(visible_users(viewer).where(User.id == user_id))
    if not found:
        raise NotFound("User not found")
    return found


def list_users(db: Session, viewer: User, filters: dict, page: int, page_size: int):
    query = visible_users(viewer)
    if viewer.role != UserRole.HR_ADMIN:
        query = query.where(User.id != viewer.id)
    for column in ("department_id", "role", "status"):
        if filters.get(column) is not None:
            query = query.where(getattr(User, column) == filters[column])
    if filters.get("country"):
        query = query.where(User.country_code == filters["country"].upper())
    if filters.get("is_active") is not None:
        query = query.where(User.is_active == filters["is_active"])
    text = (filters.get("search") or "").strip()
    if text:
        query = query.where(or_(contains(User.full_name, text), contains(User.email, text)))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return rows, total


def lookup_users(
    db: Session, department_id: int | None, search: str | None, managing: bool = False
) -> list[User]:
    query = select(User).where(User.is_active)
    if department_id:
        query = query.where(User.department_id == department_id)
    if managing:
        query = query.where(User.role.in_(MANAGING_ROLES))
    if search and search.strip():
        query = query.where(contains(User.full_name, search.strip()))
    return list(db.scalars(query.order_by(User.full_name).limit(50)))


def _check_references(db: Session, country: str | None, department_id: int | None) -> None:
    if country is not None and not db.get(Country, country.upper()):
        raise Invalid("Unknown country")
    if department_id is not None and not db.get(Department, department_id):
        raise Invalid("Unknown department")


def _check_manager(db: Session, user_id: int | None, manager_id: int | None) -> None:
    if manager_id is None:
        return
    # One reporting-line change at a time, so two edits cannot each close half of a loop.
    db.execute(select(func.pg_advisory_xact_lock(REPORTING_LINE_LOCK)))
    manager = db.get(User, manager_id, populate_existing=True)
    if not manager or not manager.is_active or manager.role not in MANAGING_ROLES:
        raise Invalid("The manager must be an active Manager or HR Admin")
    # Walk up the chain: the new manager must not report, directly or not, to this user.
    while manager:
        if manager.id == user_id:
            raise Invalid("This would make the reporting line loop back on itself")
        above = manager.manager_id
        manager = db.get(User, above, populate_existing=True) if above else None


def set_password(db: Session, actor: User, user_id: int, password: str) -> None:
    user = db.get(User, user_id)
    if not user:
        raise NotFound("User not found")
    if user.id == actor.id:
        # Their own change must prove the current password first.
        raise Conflict("Change your own password on the Account page", "OWN_PASSWORD")
    user.password_hash = hash_password(password)
    # Ends every session the person has, in case the old password was known to someone else.
    user.token_version += 1
    db.commit()


def direct_reports(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).where(User.manager_id == user_id, User.is_active))


def open_work(db: Session, user_id: int) -> int:
    return requests.count_open_assigned(db, user_id) + onboarding.count_open_assigned(db, user_id)


def create_user(db: Session, data: UserCreate) -> User:
    _check_references(db, data.country, data.department_id)
    _check_manager(db, None, data.manager_id)
    fields = data.model_dump(exclude={"password", "country", "email"})
    user = User(
        **fields,
        email=data.email.lower(),
        country_code=data.country.upper(),
        password_hash=hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise Conflict("A user with this email already exists", "EMAIL_TAKEN") from None
    return user


def update_user(db: Session, actor: User, user_id: int, data: UserUpdate) -> User:
    user = db.get(User, user_id)
    if not user:
        raise NotFound("User not found")
    # An explicit null only means something for the manager; everywhere else it is ignored.
    changes = {
        field: value
        for field, value in data.model_dump(exclude_unset=True).items()
        if value is not None or field == "manager_id"
    }
    if user.id == actor.id and changes.get("is_active") is False:
        raise Conflict("You cannot disable your own sign-in", "OWN_ACCOUNT")
    if user.id == actor.id and changes.get("role", user.role) != user.role:
        # Otherwise the last HR Admin could lock everyone out of administration.
        raise Conflict("You cannot change your own role", "OWN_ROLE")
    _check_references(db, changes.get("country"), changes.get("department_id"))
    # Checked only when the manager changes, so other edits still save under an old manager.
    if changes.get("manager_id") and changes["manager_id"] != user.manager_id:
        _check_manager(db, user.id, changes["manager_id"])
        if requests.holds_confidential_request_from(db, changes["manager_id"], user.id):
            raise Conflict(
                "This person is handling a confidential request from the employee. "
                "Reassign that request first.",
                "CONFIDENTIAL_REQUEST",
            )

    has_reports = db.scalar(select(func.count()).where(User.manager_id == user.id))
    if changes.get("role") == UserRole.EMPLOYEE and has_reports:
        raise Conflict("Move this user's direct reports to another manager first", "HAS_REPORTS")
    if changes.get("is_active") is False and user.is_active:
        # Never blocked by unfinished work: cutting access must not wait on reassignment.
        user.token_version += 1
    moved = changes.get("department_id", user.department_id) != user.department_id
    if moved or changes.get("role") == UserRole.EMPLOYEE:
        # A head must be a manager inside the department, so the pointer cannot outlive either.
        db.execute(update(Department).where(Department.head_id == user.id).values(head_id=None))

    if "country" in changes:
        user.country_code = changes.pop("country").upper()
    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    # The manager, department and country objects were loaded before the ids changed.
    db.refresh(user)
    return user


def set_department_head(db: Session, department_id: int, head_id: int | None) -> Department:
    department = db.get(Department, department_id)
    if not department:
        raise NotFound("Department not found")
    if head_id is not None:
        head = db.get(User, head_id)
        if (
            not head
            or not head.is_active
            or head.department_id != department_id
            or head.role not in MANAGING_ROLES
        ):
            raise Invalid("The head must be an active Manager or HR Admin in this department")
    department.head_id = head_id
    db.commit()
    db.refresh(department)
    return department
