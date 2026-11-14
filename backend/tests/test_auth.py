from conftest import PASSWORD, auth
from sqlalchemy import select

from app.modules.requests.models import RequestCategory, ServiceRequest

API = "/api/v1"


def login(client, email, password=PASSWORD):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def test_health_is_public(client):
    assert client.get(f"{API}/health").json() == {"status": "ok"}
    assert client.head(f"{API}/health").status_code == 200


def test_login_returns_token_and_user(client, world):
    response = login(client, "Employee@Example.test")
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "EMPLOYEE"
    assert "password_hash" not in body["user"]

    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["id"] == world.employee.id


def test_wrong_password_and_unknown_email_look_the_same(client, world):
    wrong = login(client, world.employee.email, "not-the-password")
    unknown = login(client, "nobody@example.test")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_inactive_user_cannot_log_in_or_use_an_old_token(client, world, db):
    headers = auth(world.employee)
    world.employee.is_active = False
    db.flush()
    assert login(client, world.employee.email).status_code == 401
    assert client.get(f"{API}/auth/me", headers=headers).status_code == 401


def test_missing_or_bad_token_is_rejected(client, world):
    assert client.get(f"{API}/auth/me").status_code == 401
    bad = client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert bad.status_code == 401


def test_logout_invalidates_the_token(client, world):
    headers = auth(world.employee)
    assert client.post(f"{API}/auth/logout", headers=headers).status_code == 204
    assert client.get(f"{API}/auth/me", headers=headers).status_code == 401


def test_role_change_applies_to_an_existing_token(client, world, db):
    headers = auth(world.employee)
    assert client.get(f"{API}/users", headers=headers).status_code == 403
    world.employee.role = "HR_ADMIN"
    db.flush()
    assert client.get(f"{API}/users", headers=headers).status_code == 200


def test_over_long_password_is_a_plain_401_for_known_and_unknown_emails(client, world):
    known = login(client, world.employee.email, "a" * 100)
    unknown = login(client, "nobody@example.test", "a" * 100)
    assert known.status_code == unknown.status_code == 401
    assert known.json() == unknown.json()


def test_user_changes_their_own_password(client, world):
    old = auth(world.employee)
    url = f"{API}/auth/password"
    wrong = {"current_password": "not-the-password", "new_password": "Fresh@2027"}
    refused = client.post(url, json=wrong, headers=old)
    assert refused.status_code == 422
    assert refused.json()["error"]["details"]["fields"] == {
        "current_password": "Current password is not correct"
    }
    for weak in ("short1", "lettersonly", PASSWORD):
        body = {"current_password": PASSWORD, "new_password": weak}
        fields = client.post(url, json=body, headers=old).json()["error"]["details"]["fields"]
        assert list(fields) == ["new_password"]

    changed = client.post(
        url, json={"current_password": PASSWORD, "new_password": "Fresh@2027"}, headers=old
    )
    assert changed.status_code == 200
    fresh = {"Authorization": f"Bearer {changed.json()['access_token']}"}
    assert client.get(f"{API}/auth/me", headers=fresh).status_code == 200
    # Every session that existed before the change is ended.
    assert client.get(f"{API}/auth/me", headers=old).status_code == 401
    assert login(client, world.employee.email).status_code == 401
    assert login(client, world.employee.email, "Fresh@2027").status_code == 200


def test_forgotten_password_becomes_a_request_for_hr(client, world, db):
    db.add(
        RequestCategory(
            name="Account Access",
            description="Sign-in problems",
            owning_department_id=world.people.id,
            is_confidential=True,
        )
    )
    db.flush()
    url = f"{API}/auth/forgot-password"
    known = client.post(url, json={"email": " Employee@Example.test "})
    unknown = client.post(url, json={"email": "nobody@example.test"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    client.post(url, json={"email": world.employee.email})  # asking twice adds nothing

    raised = db.scalars(select(ServiceRequest)).all()
    assert [(r.requester_id, r.title, r.status.value) for r in raised] == [
        (world.employee.id, "Forgot password", "SUBMITTED")
    ]
    # HR Admin sees it; the person's manager does not.
    path = f"{API}/requests/{raised[0].id}"
    assert client.get(path, headers=auth(world.admin)).status_code == 200
    assert client.get(path, headers=auth(world.manager)).status_code == 404
    assert client.post(url, json={"email": "not-an-email"}).status_code == 422
