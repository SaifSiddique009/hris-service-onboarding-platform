from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.onboarding.models import OnboardingTask, TaskStatus


def count_open_assigned(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).where(
            OnboardingTask.assignee_id == user_id, OnboardingTask.status != TaskStatus.COMPLETED
        )
    )
