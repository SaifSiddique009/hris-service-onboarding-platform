from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.requests.models import RequestStatus, ServiceRequest

UNRESOLVED = (RequestStatus.SUBMITTED, RequestStatus.ASSIGNED, RequestStatus.IN_PROGRESS)


def count_open_assigned(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).where(
            ServiceRequest.assignee_id == user_id, ServiceRequest.status.in_(UNRESOLVED)
        )
    )
