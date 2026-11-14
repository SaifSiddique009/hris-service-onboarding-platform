from collections import Counter
from datetime import date

from sqlalchemy import select

from app.modules.onboarding.models import OnboardingChecklist, OnboardingTask
from app.modules.requests.models import ServiceRequest
from app.modules.users.models import User
from app.seed.__main__ import seed_all


def test_seed_meets_the_required_mix(db):
    today = date(2026, 11, 14)
    seed_all(db, today)

    users = db.scalars(select(User)).all()
    assert len(users) == 100
    assert len({u.email for u in users}) == 100
    assert Counter(u.country_code for u in users) == {"BD": 40, "MY": 25, "LK": 20, "CY": 15}
    assert {u.role.value for u in users} == {"EMPLOYEE", "MANAGER", "HR_ADMIN"}
    assert {u.status.value for u in users} == {"ACTIVE", "ON_PROBATION", "ON_NOTICE"}
    assert len({u.department_id for u in users}) >= 4
    new_hires = [u for u in users if (today - u.joining_date).days <= 60]
    assert 5 <= len(new_hires) <= 10
    assert {u.country_code for u in new_hires} == {"BD", "MY", "LK", "CY"}

    requests = db.scalars(select(ServiceRequest)).all()
    assert len(requests) >= 30
    assert {r.status.value for r in requests} == {
        "SUBMITTED",
        "ASSIGNED",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
    }
    assert {r.priority.value for r in requests} == {"LOW", "MEDIUM", "HIGH", "URGENT"}
    assert len({r.category_id for r in requests}) == 5
    threads = [r for r in requests if 2 <= len(r.comments) <= 4]
    assert len(threads) >= 5

    for request in requests:
        times = [e.created_at for e in request.history]
        assert times == sorted(times), request.title
        assert request.created_at == times[0]
        assert (request.status.value == "CLOSED") == (request.closed_at is not None)

    checklists = db.scalars(select(OnboardingChecklist)).all()
    assert 5 <= len(checklists) <= 10
    assert all(8 <= len(c.tasks) <= 12 for c in checklists)
    assert {c.employee_id for c in checklists} == {u.id for u in new_hires}
    tasks = db.scalars(select(OnboardingTask)).all()
    assert {t.status.value for t in tasks} == {"NOT_STARTED", "IN_PROGRESS", "COMPLETED"}
    assert sum(t.is_overdue for t in tasks) >= 3
    assert sum(t.is_blocked for t in tasks) >= 2
    assert sum(t.depends_on_task_id is not None for t in tasks) >= len(checklists) * 5
    assert any(not c.is_active for c in checklists) and any(c.is_active for c in checklists)
    by_id = {t.id: t for t in tasks}
    for task in tasks:
        waited_for = by_id.get(task.depends_on_task_id)
        if task.started_at and waited_for:
            assert task.started_at >= waited_for.completed_at, task.title
