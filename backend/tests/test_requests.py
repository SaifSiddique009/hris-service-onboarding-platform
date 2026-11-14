import pytest
from conftest import auth
from sqlalchemy.exc import IntegrityError

from app.modules.requests.models import RequestCategory, ServiceRequest

API = "/api/v1"


@pytest.fixture
def categories(db, world):
    items = {
        "it": RequestCategory(
            name="IT Equipment", description="Hardware", owning_department_id=world.it.id
        ),
        "hr": RequestCategory(
            name="HR Query",
            description="Personal matters",
            owning_department_id=world.people.id,
            is_confidential=True,
        ),
        "other": RequestCategory(name="Other", description="Anything else"),
    }
    db.add_all(items.values())
    db.flush()
    return items


@pytest.fixture
def submit(client, categories):
    def _submit(user, category="it", **overrides):
        body = {
            "title": "Laptop screen is cracked",
            "description": "The screen cracked when the laptop fell off my desk.",
            "category_id": categories[category].id,
            "priority": "HIGH",
        } | overrides
        response = client.post(f"{API}/requests", json=body, headers=auth(user))
        assert response.status_code == 201, response.text
        return response.json()

    return _submit


@pytest.fixture
def do(client):
    def _do(user, request, action, note=None, assignee=None):
        url = f"{API}/requests/{request['id']}"
        if action in ("assign", "reassign"):
            body = {"assignee_id": assignee.id, "note": note}
            return client.post(f"{url}/{action}", json=body, headers=auth(user))
        body = {"action": action, "note": note}
        return client.post(f"{url}/transitions", json=body, headers=auth(user))

    return _do


def fetch(client, user, request):
    return client.get(f"{API}/requests/{request['id']}", headers=auth(user))


def listed(client, user, query=""):
    response = client.get(f"{API}/requests{query}", headers=auth(user))
    return [item["id"] for item in response.json()["items"]]


def test_new_request_starts_submitted_with_a_history_row(submit, world):
    request = submit(world.employee)
    assert request["status"] == "SUBMITTED"
    assert request["reference"] == f"REQ-{request['id']:04d}"
    assert request["assignee"] is None
    assert [e["to_status"] for e in request["history"]] == ["SUBMITTED"]


def test_who_can_see_a_request(client, submit, world):
    request = submit(world.employee)
    for viewer in (world.employee, world.manager, world.it_manager, world.admin):
        assert fetch(client, viewer, request).status_code == 200
        assert request["id"] in listed(client, viewer)
    # A colleague, and an IT engineer who is not yet the assignee, cannot.
    for outsider in (world.colleague, world.it_engineer):
        assert fetch(client, outsider, request).status_code == 404
        assert listed(client, outsider) == []


def test_request_with_no_owning_department_reaches_only_the_requesters_manager(
    client, submit, world
):
    request = submit(world.employee, "other")
    assert fetch(client, world.manager, request).status_code == 200
    assert fetch(client, world.it_manager, request).status_code == 404


def test_confidential_request_bypasses_the_manager(client, submit, do, world):
    request = submit(world.employee, "hr", title="Question about my manager's feedback")
    assert fetch(client, world.manager, request).status_code == 404
    assert listed(client, world.manager) == []
    assert do(world.manager, request, "assign", assignee=world.colleague).status_code == 404

    # Not even by assignment: an assignee can read the request.
    to_manager = do(world.admin, request, "assign", assignee=world.manager)
    assert to_manager.status_code == 422

    assert do(world.admin, request, "assign", assignee=world.it_engineer).status_code == 200
    assert fetch(client, world.it_engineer, request).status_code == 200
    assert fetch(client, world.manager, request).status_code == 404


def test_full_lifecycle(client, submit, do, world):
    request = submit(world.employee)
    assert do(world.manager, request, "assign", assignee=world.it_engineer).status_code == 200
    assert do(world.it_engineer, request, "start").status_code == 200
    resolved = do(world.it_engineer, request, "resolve", note="Replaced the screen.")
    assert resolved.json()["resolved_at"]

    reopened = do(world.employee, request, "reopen", note="The new screen flickers.")
    assert reopened.json()["status"] == "IN_PROGRESS"
    assert reopened.json()["resolved_at"] is None

    do(world.it_engineer, request, "resolve", note="Reseated the display cable.")
    closed = do(world.employee, request, "close").json()
    assert closed["status"] == "CLOSED"
    assert closed["closure_reason"] == "COMPLETED"
    assert closed["allowed_actions"] == []
    assert [e["to_status"] for e in closed["history"]] == [
        "SUBMITTED",
        "ASSIGNED",
        "IN_PROGRESS",
        "RESOLVED",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
    ]
    assert closed["history"][1]["actor"]["full_name"] == "Manager"
    assert len(closed["assignments"]) == 1


def test_only_the_permitted_actor_can_take_each_action(submit, do, world):
    request = submit(world.employee)
    # The requester cannot route their own request.
    assert do(world.employee, request, "assign", assignee=world.it_engineer).status_code == 403
    do(world.manager, request, "assign", assignee=world.it_engineer)
    # Only the assignee starts and resolves, whatever the role.
    for not_assignee in (world.manager, world.admin, world.employee):
        assert do(not_assignee, request, "start").status_code == 403
    do(world.it_engineer, request, "start")
    assert do(world.admin, request, "resolve", note="Done").status_code == 403
    do(world.it_engineer, request, "resolve", note="Done")
    # Only the requester reopens; the requester or HR Admin closes.
    assert do(world.admin, request, "reopen", note="Not fixed").status_code == 403
    assert do(world.manager, request, "close").status_code == 403
    assert do(world.admin, request, "close").status_code == 200


def test_actions_from_the_wrong_status_are_conflicts(submit, do, world):
    request = submit(world.employee)
    for action in ("close", "reopen"):
        response = do(world.employee, request, action, note="x")
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "INVALID_TRANSITION"
    assert do(world.employee, request, "teleport").status_code == 409


def test_required_notes(submit, do, world):
    request = submit(world.employee)
    assert do(world.manager, request, "reject").status_code == 422
    assert do(world.manager, request, "reject", note="   ").status_code == 422


def test_assignee_rules(submit, do, world, db):
    request = submit(world.employee)
    assert do(world.manager, request, "assign", assignee=world.employee).status_code == 422
    world.it_engineer.is_active = False
    db.flush()
    assert do(world.manager, request, "assign", assignee=world.it_engineer).status_code == 422


def test_second_assign_is_refused_and_reassign_is_deliberate(submit, do, world):
    request = submit(world.employee)
    assert do(world.manager, request, "assign", assignee=world.it_engineer).status_code == 200

    second = do(world.it_manager, request, "assign", assignee=world.it_manager)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ALREADY_ASSIGNED"
    assert "IT Engineer" in second.json()["error"]["message"]

    do(world.it_engineer, request, "start")
    moved = do(world.it_manager, request, "reassign", assignee=world.it_manager, note="On leave")
    assert moved.json()["status"] == "ASSIGNED"
    assert moved.json()["assignee"]["full_name"] == "IT Manager"
    assert len(moved.json()["assignments"]) == 2


def test_withdraw_and_reject_record_why_the_request_closed(submit, do, world):
    withdrawn = do(world.employee, submit(world.employee), "withdraw").json()
    assert (withdrawn["status"], withdrawn["closure_reason"]) == ("CLOSED", "WITHDRAWN")

    rejected = do(world.it_manager, submit(world.employee), "reject", note="Duplicate").json()
    assert rejected["closure_reason"] == "REJECTED"
    assert rejected["history"][-1]["note"] == "Duplicate"

    # An assignee handed an invalid request can send it back before starting.
    assigned = submit(world.employee)
    do(world.manager, assigned, "assign", assignee=world.it_engineer)
    by_assignee = do(world.it_engineer, assigned, "reject", note="Not an IT issue")
    assert by_assignee.json()["closure_reason"] == "REJECTED"

    # Withdrawing is only for the requester, and only before assignment.
    other = submit(world.employee)
    assert do(world.manager, other, "withdraw").status_code == 403
    do(world.manager, other, "assign", assignee=world.it_engineer)
    assert do(world.employee, other, "withdraw").status_code == 409


def test_allowed_actions_follow_the_viewer(client, submit, do, world):
    request = submit(world.employee)

    def actions(user):
        return set(fetch(client, user, request).json()["allowed_actions"])

    assert actions(world.employee) == {"withdraw", "comment"}
    assert actions(world.manager) == {"assign", "reject", "comment"}
    do(world.manager, request, "assign", assignee=world.it_engineer)
    assert actions(world.it_engineer) == {"start", "reject", "comment"}
    assert actions(world.employee) == {"comment"}
    assert actions(world.admin) == {"reassign", "reject", "comment"}


def test_comments(client, submit, do, world):
    request = submit(world.employee)
    url = f"{API}/requests/{request['id']}/comments"
    first = client.post(url, json={"body": "Any update?"}, headers=auth(world.employee))
    assert first.status_code == 201
    assert first.json()["author"]["full_name"] == "Employee"
    client.post(url, json={"body": "Looking into it."}, headers=auth(world.manager))
    outsider = client.post(url, json={"body": "Hi"}, headers=auth(world.colleague))
    assert outsider.status_code == 404

    thread = fetch(client, world.employee, request).json()["comments"]
    assert [c["body"] for c in thread] == ["Any update?", "Looking into it."]

    do(world.employee, request, "withdraw")
    closed = client.post(url, json={"body": "Too late"}, headers=auth(world.employee))
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "REQUEST_CLOSED"


def test_views_and_filters(client, submit, do, world):
    mine = submit(world.manager, "other", priority="LOW")
    team = submit(world.employee)
    from_cyprus = submit(world.it_manager, "other", priority="URGENT")
    do(world.manager, team, "assign", assignee=world.it_engineer)

    assert listed(client, world.manager, "?view=mine") == [mine["id"]]
    assert listed(client, world.manager, "?view=team") == [team["id"]]
    assert listed(client, world.it_engineer, "?view=assigned") == [team["id"]]
    assert listed(client, world.it_manager, "?view=queue") == [team["id"]]

    admin = world.admin
    assert set(listed(client, admin)) == {mine["id"], team["id"], from_cyprus["id"]}
    assert listed(client, admin, "?country=CY") == [from_cyprus["id"]]
    assert listed(client, admin, "?status=ASSIGNED") == [team["id"]]
    assert listed(client, admin, "?priority=LOW") == [mine["id"]]
    assert listed(client, admin, f"?category_id={team['category']['id']}") == [team["id"]]
    assert listed(client, admin, "?search=cracked&priority=URGENT") == [from_cyprus["id"]]


def test_database_refuses_impossible_states(db, world, categories):
    def request(**fields):
        return ServiceRequest(
            title="x",
            description="x",
            category_id=categories["it"].id,
            priority="LOW",
            requester_id=world.employee.id,
            **fields,
        )

    for impossible in (
        request(status="ASSIGNED"),
        request(status="CLOSED"),
        request(status="SUBMITTED", closure_reason="REJECTED"),
    ):
        with db.begin_nested(), pytest.raises(IntegrityError):
            db.add(impossible)
            db.flush()
