from datetime import UTC, date, datetime, timedelta

import pytest
from conftest import auth
from sqlalchemy.exc import IntegrityError

from app.modules.onboarding import service as onboarding
from app.modules.onboarding.models import DeadlineUnit, OnboardingTask
from app.modules.onboarding.schemas import TemplateTaskCreate
from app.modules.onboarding.service import due_date
from app.modules.users.models import Country

API = "/api/v1/onboarding"
LONG_AGO = "2020-01-06"
AHEAD = date.today() + timedelta(days=200)
FAR_AHEAD = AHEAD.isoformat()


@pytest.fixture
def template(client, world):
    """account -> laptop (waits for account), welcome and goals owned by the line manager."""
    admin = auth(world.admin)
    created = client.post(
        f"{API}/templates",
        json={"name": "Engineering", "description": "For engineers"},
        headers=admin,
    ).json()

    def add(title, unit="DAY", value=1, waits_for=None, department=world.it.id):
        body = {
            "title": title,
            "description": f"{title} for the new hire",
            "owner_kind": "DEPARTMENT" if department else "LINE_MANAGER",
            "owner_department_id": department,
            "deadline_unit": unit,
            "deadline_value": value,
            "depends_on_task_id": waits_for,
        }
        response = client.post(f"{API}/templates/{created['id']}/tasks", json=body, headers=admin)
        assert response.status_code == 201, response.text
        return response.json()

    account = add("Create account")
    add("Issue laptop", value=2, waits_for=account["id"])
    add("Welcome meeting", department=None)
    add("Agree goals", unit="WEEK", value=2, department=None)
    return client.get(f"{API}/templates/{created['id']}", headers=admin).json()


@pytest.fixture
def assign(client, world, template):
    def _assign(employee=None, start=FAR_AHEAD):
        body = {
            "employee_id": (employee or world.employee).id,
            "template_id": template["id"],
            "start_date": start,
        }
        response = client.post(f"{API}/checklists", json=body, headers=auth(world.admin))
        assert response.status_code == 201, response.text
        return response.json()

    return _assign


@pytest.fixture
def act(client):
    def _act(user, task, action):
        url = f"{API}/tasks/{task['id']}/transitions"
        return client.post(url, json={"action": action}, headers=auth(user))

    return _act


def tasks_of(checklist):
    return {task["title"]: task for task in checklist["tasks"]}


def reload(client, user, checklist):
    return client.get(f"{API}/checklists/{checklist['id']}", headers=auth(user))


@pytest.mark.parametrize(
    ("unit", "value", "expected"),
    [("DAY", 1, "2026-11-02"), ("DAY", 2, "2026-11-03"), ("WEEK", 1, "2026-11-08"),
     ("WEEK", 2, "2026-11-15"), ("DAY", 30, "2026-12-01")],
)  # fmt: skip
def test_due_dates_count_day_one_as_the_start_date(unit, value, expected):
    assert due_date(date(2026, 11, 2), DeadlineUnit(unit), value) == date.fromisoformat(expected)


def test_templates_are_for_hr_admin_only(client, world, template):
    for user in (world.manager, world.employee):
        assert client.get(f"{API}/templates", headers=auth(user)).status_code == 403
    listed = client.get(f"{API}/templates", headers=auth(world.admin)).json()
    assert [(t["name"], t["task_count"]) for t in listed] == [("Engineering", 4)]
    labels = [t["deadline_label"] for t in template["tasks"]]
    assert labels == ["Day 1", "Day 2", "Day 1", "Week 2"]


def test_template_dependencies_cannot_loop_or_leave_the_template(client, world, template):
    admin = auth(world.admin)
    url = f"{API}/templates/{template['id']}/tasks"
    account, laptop, welcome, _ = template["tasks"]

    loop = client.patch(
        f"{url}/{account['id']}", json={"depends_on_task_id": laptop["id"]}, headers=admin
    )
    assert loop.status_code == 409
    assert loop.json()["error"]["code"] == "CYCLE"
    own = client.patch(
        f"{url}/{welcome['id']}", json={"depends_on_task_id": welcome["id"]}, headers=admin
    )
    assert own.status_code == 409

    other = client.post(
        f"{API}/templates", json={"name": "Other", "description": "Another one"}, headers=admin
    ).json()
    foreign = client.post(
        f"{API}/templates/{other['id']}/tasks",
        json={
            "title": "Borrowed dependency",
            "description": "Waits for a task elsewhere",
            "owner_kind": "LINE_MANAGER",
            "deadline_unit": "DAY",
            "deadline_value": 1,
            "depends_on_task_id": account["id"],
        },
        headers=admin,
    )
    assert foreign.status_code == 422


def test_template_task_with_dependents_cannot_be_deleted(client, world, template):
    admin = auth(world.admin)
    url = f"{API}/templates/{template['id']}/tasks"
    account, laptop, *_ = template["tasks"]
    blocked = client.delete(f"{url}/{account['id']}", headers=admin)
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "HAS_DEPENDENTS"
    assert "waits for this task" in blocked.json()["error"]["message"]
    assert client.delete(f"{url}/{laptop['id']}", headers=admin).status_code == 204
    assert client.delete(f"{url}/{account['id']}", headers=admin).status_code == 204


def test_assigning_copies_the_template_with_real_dates_and_owners(assign, world):
    checklist = assign(start="2026-11-02")
    tasks = tasks_of(checklist)
    assert checklist["warnings"] == []
    assert {t: tasks[t]["due_date"] for t in tasks} == {
        "Create account": "2026-11-02",
        "Issue laptop": "2026-11-03",
        "Welcome meeting": "2026-11-02",
        "Agree goals": "2026-11-15",
    }
    # Department tasks go to the department head, line-manager tasks to the hire's manager.
    assert tasks["Create account"]["assignee"]["full_name"] == "IT Manager"
    assert tasks["Welcome meeting"]["assignee"]["full_name"] == "Manager"
    # The dependency points at the copy in this checklist, not at the template task.
    assert tasks["Issue laptop"]["depends_on"]["id"] == tasks["Create account"]["id"]
    assert all(len(task["history"]) == 1 for task in tasks.values())


def test_start_date_defaults_to_the_joining_date(client, world, template):
    body = {"employee_id": world.employee.id, "template_id": template["id"]}
    checklist = client.post(f"{API}/checklists", json=body, headers=auth(world.admin)).json()
    assert checklist["start_date"] == "2024-01-15"


def test_one_checklist_per_employee_and_only_admin_assigns(client, world, template, assign):
    assign()
    body = {"employee_id": world.employee.id, "template_id": template["id"]}
    again = client.post(f"{API}/checklists", json=body, headers=auth(world.admin))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "ALREADY_ONBOARDING"
    denied = client.post(f"{API}/checklists", json=body, headers=auth(world.manager))
    assert denied.status_code == 403


def test_task_without_an_active_owner_falls_back_to_the_admin_and_says_so(assign, world, db):
    world.it.head_id = None
    db.flush()
    checklist = assign()
    assert len(checklist["warnings"]) == 2
    assert "Create account" in checklist["warnings"][0]
    assert tasks_of(checklist)["Create account"]["assignee"]["full_name"] == "Admin"


def test_editing_a_template_does_not_change_existing_checklists(client, world, template, assign):
    checklist = assign()
    task = template["tasks"][0]
    client.patch(
        f"{API}/templates/{template['id']}/tasks/{task['id']}",
        json={"title": "Create account and mailbox", "deadline_value": 5},
        headers=auth(world.admin),
    )
    after = reload(client, world.admin, checklist).json()
    assert "Create account" in tasks_of(after)
    assert (
        tasks_of(after)["Create account"]["due_date"]
        == tasks_of(checklist)["Create account"]["due_date"]
    )


def test_who_can_see_a_checklist(client, world, assign):
    checklist = assign()

    def ids(user):
        return [c["id"] for c in client.get(f"{API}/checklists", headers=auth(user)).json()]

    for viewer in (world.employee, world.manager, world.admin):
        assert reload(client, viewer, checklist).status_code == 200
        assert ids(viewer) == [checklist["id"]]
    # A colleague, and a task owner who is not the hire's manager, cannot open the checklist.
    for outsider in (world.colleague, world.it_manager):
        assert reload(client, outsider, checklist).status_code == 404
        assert ids(outsider) == []

    mine = client.get(f"{API}/checklists/me", headers=auth(world.employee))
    assert mine.json()["id"] == checklist["id"]
    assert client.get(f"{API}/checklists/me", headers=auth(world.colleague)).status_code == 404


def test_task_owner_sees_their_tasks_across_new_hires(client, world, assign):
    assign(world.employee)
    assign(world.colleague)
    mine = client.get(f"{API}/tasks/mine", headers=auth(world.it_manager)).json()
    assert sorted((t["employee"]["full_name"], t["title"]) for t in mine) == [
        ("Colleague", "Create account"),
        ("Colleague", "Issue laptop"),
        ("Employee", "Create account"),
        ("Employee", "Issue laptop"),
    ]
    assert client.get(f"{API}/tasks/mine", headers=auth(world.colleague)).json() == []


def test_dependent_task_is_blocked_until_its_dependency_is_completed(client, world, assign, act):
    checklist = assign()
    tasks = tasks_of(checklist)
    laptop, account = tasks["Issue laptop"], tasks["Create account"]
    assert laptop["status"] == "NOT_STARTED"
    assert laptop["effective_status"] == "BLOCKED"
    assert laptop["allowed_actions"] == []
    assert checklist["progress"] == {
        "total": 4,
        "completed": 0,
        "in_progress": 0,
        "not_started": 3,
        "blocked": 1,
        "overdue": 0,
    }

    for action in ("start", "complete"):
        refused = act(world.it_manager, laptop, action)
        assert refused.status_code == 409
        assert refused.json()["error"]["code"] == "TASK_BLOCKED"

    act(world.it_manager, account, "start")
    assert act(world.it_manager, laptop, "start").status_code == 409  # still not completed
    act(world.it_manager, account, "complete")

    # Unblocked with no write to the dependent task: the condition is simply no longer true.
    laptop = tasks_of(reload(client, world.admin, checklist).json())["Issue laptop"]
    assert laptop["effective_status"] == "NOT_STARTED"
    assert act(world.it_manager, laptop, "start").json()["status"] == "IN_PROGRESS"


def test_only_the_assignee_or_hr_admin_changes_a_task(client, world, assign, act):
    account = tasks_of(assign())["Create account"]
    # The new hire and their manager can see the task but do not own it.
    assert act(world.employee, account, "start").status_code == 403
    assert act(world.manager, account, "start").status_code == 403
    assert act(world.colleague, account, "start").status_code == 404
    assert act(world.it_manager, account, "start").status_code == 200
    done = act(world.admin, account, "complete").json()
    assert done["status"] == "COMPLETED"
    assert done["completed_at"]


def test_task_actions_from_the_wrong_status_are_conflicts(world, assign, act):
    account = tasks_of(assign())["Create account"]
    for action in ("put_back", "reopen"):
        assert act(world.it_manager, account, action).status_code == 409
    assert act(world.it_manager, account, "teleport").status_code == 422
    act(world.it_manager, account, "start")
    assert act(world.it_manager, account, "put_back").json()["status"] == "NOT_STARTED"


def test_completed_task_cannot_be_reopened_under_a_started_dependent(world, assign, act):
    tasks = tasks_of(assign())
    account, laptop = tasks["Create account"], tasks["Issue laptop"]
    act(world.it_manager, account, "complete")
    act(world.it_manager, laptop, "start")

    refused = act(world.it_manager, account, "reopen")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "DEPENDENT_STARTED"
    assert refused.json()["error"]["message"].startswith('"Issue laptop" waits for this task')

    act(world.it_manager, laptop, "put_back")
    assert act(world.it_manager, account, "reopen").json()["status"] == "IN_PROGRESS"


def test_overdue_is_derived_from_the_due_date_and_cleared_by_completion(client, world, assign, act):
    checklist = assign(start=LONG_AGO)
    assert all(task["is_overdue"] for task in checklist["tasks"])
    assert checklist["progress"]["overdue"] == 4
    # Blocked and overdue at once: the delay comes from the task it waits for.
    laptop = tasks_of(checklist)["Issue laptop"]
    assert (laptop["effective_status"], laptop["is_overdue"]) == ("BLOCKED", True)

    done = act(world.it_manager, tasks_of(checklist)["Create account"], "complete").json()
    assert done["is_overdue"] is False
    assert reload(client, world.admin, checklist).json()["progress"]["overdue"] == 3


def test_overdue_uses_the_new_hires_local_date(client, world, db, assign):
    # Two places 26 hours apart: it is always at least one calendar day later in the first.
    db.add_all(
        [
            Country(code="KI", name="Kiritimati", timezone="Pacific/Kiritimati"),
            Country(code="BI", name="Baker Island", timezone="Etc/GMT+12"),
        ]
    )
    world.employee.country_code, world.colleague.country_code = "KI", "BI"
    db.flush()
    today_on_baker_island = (datetime.now(UTC) - timedelta(hours=12)).date()
    start = today_on_baker_island.isoformat()

    ahead = tasks_of(assign(world.employee, start))["Create account"]
    behind = tasks_of(assign(world.colleague, start))["Create account"]
    assert ahead["due_date"] == behind["due_date"] == start
    assert ahead["is_overdue"] is True
    assert behind["is_overdue"] is False


def test_reassignment_and_due_date_change_are_recorded(client, world, assign):
    checklist = assign()
    account = tasks_of(checklist)["Create account"]
    url = f"{API}/tasks/{account['id']}"
    later = AHEAD + timedelta(days=20)
    body = {"assignee_id": world.it_engineer.id, "due_date": later.isoformat()}
    assert client.patch(url, json=body, headers=auth(world.manager)).status_code == 403

    updated = client.patch(url, json=body, headers=auth(world.admin)).json()
    assert updated["assignee"]["full_name"] == "IT Engineer"
    assert updated["due_date"] == later.isoformat()

    history = tasks_of(reload(client, world.admin, checklist).json())["Create account"]["history"]
    assert [event["note"] for event in history] == [
        None,
        "Reassigned from IT Manager to IT Engineer",
        f"Due date changed from {AHEAD.day} {AHEAD:%b %Y} to {later.day} {later:%b %Y}",
    ]
    assert history[1]["actor"]["full_name"] == "Admin"
    assert history[1]["from_status"] == history[1]["to_status"] == "NOT_STARTED"


def test_my_tasks_filters(client, world, assign, act):
    tasks = tasks_of(assign(start=LONG_AGO))
    act(world.it_manager, tasks["Create account"], "complete")

    def titles(state):
        url = f"{API}/tasks/mine?state={state}"
        return [t["title"] for t in client.get(url, headers=auth(world.it_manager)).json()]

    assert titles("completed") == ["Create account"]
    assert titles("open") == ["Issue laptop"]
    assert titles("overdue") == ["Issue laptop"]
    assert titles("blocked") == []


def test_database_refuses_a_dependency_from_another_checklist(db, world, assign):
    first = tasks_of(assign(world.employee))["Create account"]
    second = tasks_of(assign(world.colleague))["Issue laptop"]
    task = db.get(OnboardingTask, second["id"])
    with db.begin_nested(), pytest.raises(IntegrityError):
        task.depends_on_task_id = first["id"]
        db.flush()


def test_database_refuses_a_department_task_without_a_department(db, assign):
    task = db.get(OnboardingTask, tasks_of(assign())["Create account"]["id"])
    with db.begin_nested(), pytest.raises(IntegrityError):
        task.owner_department_id = None
        db.flush()


TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]


@pytest.fixture
def task_in(assign, act, world):
    def _task_in(status):
        task = tasks_of(assign())["Create account"]
        for action in ["start", "complete"][: TASK_STATUSES.index(status)]:
            assert act(world.it_manager, task, action).status_code == 200
        return task

    return _task_in


@pytest.mark.parametrize("status", TASK_STATUSES)
def test_every_task_action_follows_the_table(status, task_in, act, world):
    task = task_in(status)
    for name, action in onboarding.ACTIONS.items():
        allowed_here = status in action.sources
        # The new hire can see the task but does not own it.
        seen_but_not_owned = act(world.employee, task, name).status_code
        assert seen_but_not_owned == (403 if allowed_here else 409), (name, status)
        if not allowed_here:
            assert act(world.it_manager, task, name).status_code == 409, (name, status)


def test_database_refuses_a_template_dependency_from_another_template(db, world, template):
    other = onboarding.create_template(db, world.admin, "Second", "Another template")
    base = {
        "description": "Step",
        "owner_kind": "LINE_MANAGER",
        "deadline_unit": "DAY",
        "deadline_value": 1,
    }
    task = onboarding.add_template_task(db, other.id, TemplateTaskCreate(title="Step", **base))
    with db.begin_nested(), pytest.raises(IntegrityError):
        task.depends_on_task_id = template["tasks"][0]["id"]
        db.flush()


def test_impossible_dates_are_refused(client, world, assign, template):
    admin = auth(world.admin)
    body = {"employee_id": world.colleague.id, "template_id": template["id"]}
    for start in ("1800-01-01", "2999-01-01"):
        refused = client.post(f"{API}/checklists", json=body | {"start_date": start}, headers=admin)
        assert refused.status_code == 422

    account = tasks_of(assign())["Create account"]
    before_start = {"due_date": (AHEAD - timedelta(days=1)).isoformat()}
    refused = client.patch(f"{API}/tasks/{account['id']}", json=before_start, headers=admin)
    assert refused.status_code == 422
    assert "before the checklist start date" in refused.json()["error"]["message"]


def test_template_task_edit_with_an_unknown_department_is_refused(client, world, template):
    admin = auth(world.admin)
    tasks = client.get(f"{API}/templates/{template['id']}", headers=admin).json()["tasks"]
    url = f"{API}/templates/{template['id']}/tasks/{tasks[0]['id']}"
    for body in ({"owner_department_id": 999999}, {"sort_order": 10**15}):
        refused = client.patch(url, json=body, headers=admin)
        assert refused.status_code == 422, refused.text
    assert client.get(f"{API}/templates/{template['id']}", headers=admin).status_code == 200


def test_checklist_that_starts_long_ago_comes_with_a_warning(assign, world):
    assert any("days ago" in w for w in assign(start=LONG_AGO)["warnings"])
    assert not any("days ago" in w for w in assign(world.colleague)["warnings"])


def test_open_tasks_do_not_include_blocked_ones(client, world, assign):
    assign()
    mine = f"{API}/tasks/mine"
    headers = auth(world.it_manager)
    count = lambda state: len(client.get(f"{mine}?state={state}", headers=headers).json())  # noqa: E731
    everything = len(client.get(mine, headers=headers).json())
    assert count("blocked") >= 1
    assert count("open") + count("blocked") + count("completed") == everything
