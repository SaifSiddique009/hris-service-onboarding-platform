import threading

from conftest import World
from sqlalchemy import text, update

from app.core.db import Base, SessionLocal
from app.core.errors import Conflict
from app.modules.onboarding import service
from app.modules.onboarding.models import OnboardingTask, TaskStatus
from app.modules.onboarding.schemas import TemplateTaskCreate
from app.modules.users.models import User

ROUNDS = 5


def test_reopening_a_task_and_starting_its_dependent_cannot_both_succeed():
    """Two real connections act at the same moment; the checklist lock makes one of them lose."""
    with SessionLocal() as db:
        world = World(db)
        admin_id = world.admin.id
        template = service.create_template(db, world.admin, "Concurrency", "Two linked tasks")
        base = {
            "description": "Task for the lock test",
            "owner_kind": "LINE_MANAGER",
            "deadline_unit": "DAY",
            "deadline_value": 1,
        }
        first = service.add_template_task(
            db, template.id, TemplateTaskCreate(title="Task A", **base)
        )
        service.add_template_task(
            db, template.id, TemplateTaskCreate(title="Task B", depends_on_task_id=first.id, **base)
        )
        checklist, _ = service.assign_checklist(
            db, world.admin, world.employee.id, template.id, None
        )
        a_id, b_id = (task.id for task in checklist.tasks)

    def attempt(task_id, action, barrier, outcomes):
        with SessionLocal() as db:
            admin = db.get(User, admin_id)
            barrier.wait()
            try:
                service.transition(db, admin, task_id, action)
                outcomes[action] = "ok"
            except Conflict as error:
                outcomes[action] = error.code

    try:
        for _ in range(ROUNDS):
            with SessionLocal() as db:
                db.execute(
                    update(OnboardingTask)
                    .where(OnboardingTask.id == a_id)
                    .values(status="COMPLETED")
                )
                db.execute(
                    update(OnboardingTask)
                    .where(OnboardingTask.id == b_id)
                    .values(status="NOT_STARTED")
                )
                db.commit()

            barrier, outcomes = threading.Barrier(2), {}
            threads = [
                threading.Thread(target=attempt, args=(a_id, "reopen", barrier, outcomes)),
                threading.Thread(target=attempt, args=(b_id, "start", barrier, outcomes)),
            ]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=20)

            with SessionLocal() as db:
                a, b = db.get(OnboardingTask, a_id), db.get(OnboardingTask, b_id)
                # Exactly one wins, and B is never in progress under an unfinished A.
                assert sorted(outcomes.values()) in (
                    ["DEPENDENT_STARTED", "ok"],
                    ["TASK_BLOCKED", "ok"],
                ), outcomes
                assert a.status == TaskStatus.COMPLETED or b.status == TaskStatus.NOT_STARTED
    finally:
        with SessionLocal() as db:
            tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
            db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
            db.commit()
