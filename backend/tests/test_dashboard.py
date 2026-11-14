from datetime import date

import pytest
from conftest import auth

from app.modules.dashboard import service as reports
from app.modules.onboarding import service as onboarding
from app.modules.onboarding.schemas import TemplateTaskCreate
from app.modules.requests import service as requests
from app.modules.requests.models import RequestCategory
from app.modules.requests.schemas import RequestCreate

API = "/api/v1/dashboard"


@pytest.fixture
def data(db, world):
    """Three requests in different states and one new hire with an overdue, blocked checklist."""
    it = RequestCategory(
        name="IT Equipment", description="Hardware", owning_department_id=world.it.id
    )
    hr = RequestCategory(name="HR Query", description="Personal", is_confidential=True)
    db.add_all([it, hr])
    db.flush()

    def submit(user, category, title):
        body = RequestCreate(
            title=title, description="Details", category_id=category.id, priority="HIGH"
        )
        return requests.create_request(db, user, body)

    waiting = submit(world.employee, it, "Laptop not received")
    resolved = submit(world.it_manager, it, "Monitor request")
    requests.assign(db, world.admin, resolved.id, world.it_engineer.id, None, "assign")
    requests.act(db, world.it_engineer, resolved.id, "start", None)
    requests.act(db, world.it_engineer, resolved.id, "resolve", "Delivered")
    closed = submit(world.colleague, it, "Old request")
    requests.act(db, world.colleague, closed.id, "withdraw", None)
    private = submit(world.employee, hr, "Question about my pay")

    template = onboarding.create_template(db, world.admin, "General", "For everyone")
    base = {
        "description": "Step",
        "owner_kind": "LINE_MANAGER",
        "deadline_unit": "DAY",
        "deadline_value": 1,
    }
    first = onboarding.add_template_task(
        db, template.id, TemplateTaskCreate(title="First step", **base)
    )
    onboarding.add_template_task(
        db,
        template.id,
        TemplateTaskCreate(title="Second step", depends_on_task_id=first.id, **base),
    )
    onboarding.assign_checklist(db, world.admin, world.employee.id, template.id, date(2020, 1, 6))
    return {"waiting": waiting, "private": private}


def test_dashboard_is_for_hr_admin_only(client, world):
    for path in ("headcount", "requests", "onboarding", "insights"):
        assert client.get(f"{API}/{path}", headers=auth(world.manager)).status_code == 403
        assert client.get(f"{API}/{path}", headers=auth(world.admin)).status_code == 200


def test_headcount_counts_active_people_by_country(client, world, db):
    world.colleague.is_active = False
    db.flush()
    body = client.get(f"{API}/headcount", headers=auth(world.admin)).json()
    assert body["total"] == 5
    assert body["by_country"] == [
        {"label": "Bangladesh", "count": 4},
        {"label": "Cyprus", "count": 1},
    ]


def test_open_unresolved_and_awaiting_confirmation_are_different_numbers(client, world, data):
    body = client.get(f"{API}/requests", headers=auth(world.admin)).json()
    # Two submitted, one resolved, one closed.
    assert body["unresolved_total"] == 2
    assert body["awaiting_confirmation_total"] == 1
    assert body["open_total"] == 3
    assert {g["label"]: g["count"] for g in body["by_status"]} == {"SUBMITTED": 2, "RESOLVED": 1}
    assert {g["label"]: g["count"] for g in body["by_category"]} == {
        "IT Equipment": 2,
        "HR Query": 1,
    }


def test_onboarding_summary_counts_derived_states(client, world, data):
    body = client.get(f"{API}/onboarding", headers=auth(world.admin)).json()
    assert body == {
        "active_new_hires": 1,
        "completed_new_hires": 0,
        "overdue_tasks": 2,
        "blocked_tasks": 1,
    }


def test_new_hires_with_open_requests_and_private_titles(client, world, data):
    body = client.get(f"{API}/insights", headers=auth(world.admin)).json()
    (entry,) = body["new_hires_with_open_requests"]
    assert entry["new_hire"] == "Employee"
    titles = {r["category"]: r["title"] for r in entry["open_requests"]}
    # The confidential request is counted, but its title never leaves through a report.
    assert titles == {"IT Equipment": "Laptop not received", "HR Query": None}
    assert body["onboarding_completion_by_country"] == [
        {"country": "Bangladesh", "total_tasks": 2, "completed_tasks": 0, "rate": 0.0}
    ]


def test_work_held_by_inactive_users_is_reported(client, world, data, db):
    requests.assign(db, world.admin, data["waiting"].id, world.it_engineer.id, None, "assign")
    world.it_engineer.is_active = world.manager.is_active = False
    db.flush()
    body = client.get(f"{API}/insights", headers=auth(world.admin)).json()
    assert body["work_held_by_inactive_users"] == {"requests": 1, "onboarding_tasks": 2}


def test_report_filters_and_grouping(db, world, data):
    assert reports.count_service_requests(db, state="open", country="bangladesh")["total"] == 2
    assert reports.count_service_requests(db, state="open", country="CY")["total"] == 1
    assert reports.count_employees(db, department="it", group_by="role") == {
        "total": 2,
        "groups": [{"label": "EMPLOYEE", "count": 1}, {"label": "MANAGER", "count": 1}],
    }
    blocked = reports.list_onboarding_tasks(db, "blocked")
    assert blocked["total"] == 1
    assert [(t["task"], t["status"], t["overdue"]) for t in blocked["rows"]] == [
        ("Second step", "BLOCKED", True)
    ]
    assert reports.onboarding_progress(db, active_only=True)[0]["overdue"] == 2
