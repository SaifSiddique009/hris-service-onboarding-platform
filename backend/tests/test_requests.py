import pytest
from conftest import auth
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError

from app.modules.requests import service
from app.modules.requests.models import RequestCategory, ServiceRequest
from app.modules.users.models import UserRole

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

    # Nor to another team: only the department that owns the category handles it.
    outside = do(world.admin, request, "assign", assignee=world.it_engineer)
    assert outside.status_code == 422
    assert "People & Culture" in outside.json()["error"]["message"]

    partner = world.user("HR Partner", UserRole.EMPLOYEE, world.people)
    assert do(world.admin, request, "assign", assignee=partner).status_code == 200
    assert fetch(client, partner, request).status_code == 200
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
    assert do(world.employee, request, "teleport").status_code == 422


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

    # Being handed a request does not give the right to close it: only a triager rejects.
    assigned = submit(world.employee)
    do(world.manager, assigned, "assign", assignee=world.it_engineer)
    assert do(world.it_engineer, assigned, "reject", note="Not an IT issue").status_code == 403
    by_triager = do(world.manager, assigned, "reject", note="Not an IT issue")
    assert by_triager.json()["closure_reason"] == "REJECTED"

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
    assert actions(world.it_engineer) == {"start", "comment"}
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


def test_assignee_of_a_confidential_request_cannot_become_the_requesters_manager(
    client, submit, do, world
):
    request = submit(world.employee, "hr")
    lead = world.user("HR Lead", UserRole.MANAGER, world.people)
    partner = world.user("HR Partner", UserRole.EMPLOYEE, world.people)
    do(world.admin, request, "assign", assignee=lead)
    url = f"{API}/users/{world.employee.id}"
    refused = client.patch(url, json={"manager_id": lead.id}, headers=auth(world.admin))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "CONFIDENTIAL_REQUEST"

    do(world.admin, request, "reassign", assignee=partner)
    allowed = client.patch(url, json={"manager_id": lead.id}, headers=auth(world.admin))
    assert allowed.status_code == 200
    assert fetch(client, lead, request).status_code == 404


ALL_STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]
# For each action, someone who can see the request but may not take that action.
WRONG_ACTOR = {
    "assign": "employee",
    "reassign": "employee",
    "reject": "employee",
    "start": "admin",
    "resolve": "admin",
    "withdraw": "admin",
    "reopen": "admin",
    "close": "manager",
}


@pytest.fixture
def request_in(submit, do, world):
    """A request raised by Employee and moved to the given status."""

    def _request_in(status):
        request = submit(world.employee)
        steps = [
            (world.manager, "assign"),
            (world.it_engineer, "start"),
            (world.it_engineer, "resolve"),
            (world.employee, "close"),
        ]
        for actor, action in steps[: ALL_STATUSES.index(status)]:
            done = do(actor, request, action, note="Done", assignee=world.it_engineer)
            assert done.status_code == 200, done.text
        return request

    return _request_in


@pytest.mark.parametrize("status", ALL_STATUSES)
def test_every_action_is_a_conflict_from_a_status_it_does_not_start_from(
    status, request_in, do, world
):
    request = request_in(status)
    for name, action in service.ACTIONS.items():
        if status not in action.sources:
            response = do(world.admin, request, name, note="x", assignee=world.colleague)
            assert response.status_code == 409, (name, status, response.text)


@pytest.mark.parametrize("status", ALL_STATUSES)
def test_every_action_is_forbidden_to_someone_who_can_see_but_may_not_act(
    status, request_in, do, world
):
    request = request_in(status)
    for name, action in service.ACTIONS.items():
        if status in action.sources:
            actor = getattr(world, WRONG_ACTOR[name])
            response = do(actor, request, name, note="x", assignee=world.colleague)
            assert response.status_code == 403, (name, status, response.text)


def test_withdrawn_request_cannot_be_assigned_and_the_message_says_why(submit, do, world):
    request = submit(world.employee)
    do(world.employee, request, "withdraw")
    response = do(world.manager, request, "assign", assignee=world.it_engineer)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_TRANSITION"


def test_blank_comment_is_rejected(client, submit, world):
    request = submit(world.employee)
    url = f"{API}/requests/{request['id']}/comments"
    assert client.post(url, json={"body": "   "}, headers=auth(world.employee)).status_code == 422


def test_hr_admin_sees_confidential_requests_of_their_own_team(client, submit, world, db):
    world.employee.manager_id = world.admin.id
    db.flush()
    request = submit(world.employee, "hr")
    assert listed(client, world.admin, "?view=team") == [request["id"]]


def test_history_cannot_be_deleted_with_its_request(db, submit, world):
    request = submit(world.employee)
    # raises() is outermost so the savepoint is rolled back, not released, after the error.
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(delete(ServiceRequest).where(ServiceRequest.id == request["id"]))


@pytest.mark.parametrize("field", ["title", "description"])
def test_request_text_of_only_spaces_is_rejected(field, client, world, categories):
    body = {
        "title": "Laptop screen is cracked",
        "description": "It fell off my desk.",
        "category_id": categories["it"].id,
        "priority": "HIGH",
    } | {field: "       "}
    assert (
        client.post(f"{API}/requests", json=body, headers=auth(world.employee)).status_code == 422
    )


def test_request_title_is_stored_without_surrounding_spaces(submit, world):
    assert submit(world.employee, title="   Monitor arm   ")["title"] == "Monitor arm"


def test_history_names_who_received_the_request(client, submit, do, world):
    request = submit(world.employee)
    do(world.admin, request, "assign", assignee=world.it_engineer)
    same_person = do(world.admin, request, "reassign", assignee=world.it_engineer)
    assert same_person.status_code == 422
    assert "already has this request" in same_person.json()["error"]["message"]

    history = fetch(client, world.employee, request).json()["history"]
    assert [e["assignee"] and e["assignee"]["full_name"] for e in history] == [None, "IT Engineer"]


def test_search_finds_a_request_by_reference_or_title(client, submit, world):
    first = submit(world.employee)
    second = submit(world.employee, title="Need a second monitor")
    assert listed(client, world.admin, f"?search={second['reference']}") == [second["id"]]
    assert listed(client, world.admin, f"?search= {first['id']} ") == [first["id"]]
    assert listed(client, world.admin, "?search= monitor ") == [second["id"]]


def test_text_of_only_invisible_characters_is_refused(client, categories, world):
    body = {
        "title": "\u200b\u200b\u200b\u200b",
        "description": "The screen cracked when the laptop fell off my desk.",
        "category_id": categories["it"].id,
        "priority": "LOW",
    }
    response = client.post(f"{API}/requests", json=body, headers=auth(world.employee))
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "Title must be at least 3 characters"


def test_wrong_status_is_explained_in_plain_words(submit, do, world):
    request = submit(world.employee)
    refused = do(world.employee, request, "close")
    assert refused.status_code == 409
    assert refused.json()["error"]["message"] == "This cannot be done now: the status is Submitted"


def test_input_the_database_cannot_hold_is_refused_cleanly(client, submit, do, world, categories):
    admin = auth(world.admin)
    request = submit(world.employee, title="Laptop\x00 screen is cracked")
    assert request["title"] == "Laptop screen is cracked"
    assert client.get(f"{API}/requests?search=crack%00ed", headers=admin).status_code == 200

    too_big = 2**31
    for path in (f"/requests/{too_big}", f"/requests?category_id={too_big}"):
        refused = client.get(f"{API}{path}", headers=admin)
        assert refused.status_code == 422
        assert refused.json()["error"]["message"] == "One of the values is not valid"
    assert listed(client, world.admin, f"?search=REQ-{'9' * 20}") == []
    body = {"assignee_id": too_big, "note": None}
    url = f"{API}/requests/{request['id']}/assign"
    assert client.post(url, json=body, headers=admin).status_code == 422

    unknown = do(world.admin, request, "explode")
    assert unknown.status_code == 422
    assert unknown.json()["error"]["message"] == "Action is not valid"
