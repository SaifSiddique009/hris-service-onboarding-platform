from fastapi import APIRouter

from app.core.deps import Db, require_admin
from app.modules.dashboard import service

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[require_admin])


@router.get("/headcount")
def headcount(db: Db):
    by = {
        group: service.count_employees(db, group_by=group)
        for group in ("country", "department", "status")
    }
    return {
        "total": by["country"]["total"],
        "by_country": by["country"]["groups"],
        "by_department": by["department"]["groups"],
        "by_status": by["status"]["groups"],
    }


@router.get("/requests")
def requests(db: Db):
    def open_by(group):
        return service.count_service_requests(db, state="open", group_by=group)["groups"]

    def total(state):
        return service.count_service_requests(db, state=state)["total"]

    return {
        "open_total": total("open"),
        "unresolved_total": total("unresolved"),
        "awaiting_confirmation_total": total("awaiting_confirmation"),
        "by_status": open_by("status"),
        "by_category": open_by("category"),
        "by_priority": open_by("priority"),
    }


@router.get("/onboarding")
def onboarding(db: Db):
    return service.onboarding_summary(db)


@router.get("/insights")
def insights(db: Db):
    return {
        "new_hires_with_open_requests": service.new_hires_with_open_requests(db),
        "onboarding_completion_by_country": service.onboarding_completion_by_country(db),
        "work_held_by_inactive_users": service.work_held_by_inactive_users(db),
    }
