import pytest
from conftest import auth

API = "/api/v1"


def names(response):
    return {u["full_name"] for u in response.json()["items"]}


def new_user(world, **overrides):
    body = {
        "full_name": "New Hire",
        "email": "new.hire@example.test",
        "password": "Welcome@2026",
        "job_title": "Software Engineer",
        "role": "EMPLOYEE",
        "country": "bd",
        "department_id": world.engineering.id,
        "manager_id": world.manager.id,
        "status": "ON_PROBATION",
        "joining_date": "2026-11-02",
    }
    return body | overrides


def test_admin_sees_everyone(client, world):
    response = client.get(f"{API}/users", headers=auth(world.admin))
    assert response.json()["total"] == 6


def test_manager_sees_only_direct_reports(client, world):
    response = client.get(f"{API}/users", headers=auth(world.manager))
    assert names(response) == {"Employee", "Colleague"}


def test_employee_cannot_list_or_look_up_users(client, world):
    headers = auth(world.employee)
    assert client.get(f"{API}/users", headers=headers).status_code == 403
    assert client.get(f"{API}/users/lookup", headers=headers).status_code == 403


def test_user_outside_scope_looks_like_it_does_not_exist(client, world):
    headers = auth(world.employee)
    assert client.get(f"{API}/users/{world.employee.id}", headers=headers).status_code == 200
    assert client.get(f"{API}/users/{world.colleague.id}", headers=headers).status_code == 404
    assert client.get(f"{API}/users/999999", headers=headers).status_code == 404

    manager = auth(world.manager)
    assert client.get(f"{API}/users/{world.employee.id}", headers=manager).status_code == 200
    assert client.get(f"{API}/users/{world.it_engineer.id}", headers=manager).status_code == 404


def test_filters(client, world):
    headers = auth(world.admin)
    assert names(client.get(f"{API}/users?country=cy", headers=headers)) == {"IT Manager"}
    assert names(client.get(f"{API}/users?role=MANAGER", headers=headers)) == {
        "Manager",
        "IT Manager",
    }
    assert names(client.get(f"{API}/users?search=colle", headers=headers)) == {"Colleague"}


def test_only_admin_creates_users(client, world):
    denied = client.post(f"{API}/users", json=new_user(world), headers=auth(world.manager))
    assert denied.status_code == 403

    created = client.post(f"{API}/users", json=new_user(world), headers=auth(world.admin))
    assert created.status_code == 201
    assert created.json()["country"]["code"] == "BD"
    assert created.json()["manager"]["id"] == world.manager.id

    duplicate = client.post(f"{API}/users", json=new_user(world), headers=auth(world.admin))
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "EMAIL_TAKEN"


def test_manager_must_hold_a_managing_role(client, world):
    body = new_user(world, manager_id=world.colleague.id)
    response = client.post(f"{API}/users", json=body, headers=auth(world.admin))
    assert response.status_code == 422


def test_manager_with_reports_cannot_become_an_employee(client, world):
    response = client.patch(
        f"{API}/users/{world.manager.id}", json={"role": "EMPLOYEE"}, headers=auth(world.admin)
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "HAS_REPORTS"


def test_deactivation_signs_the_user_out(client, world):
    headers = auth(world.colleague)
    response = client.patch(
        f"{API}/users/{world.colleague.id}", json={"is_active": False}, headers=auth(world.admin)
    )
    assert response.status_code == 200
    assert client.get(f"{API}/auth/me", headers=headers).status_code == 401


def test_validation_errors_use_the_error_shape(client, world):
    response = client.post(
        f"{API}/users", json=new_user(world, email="not-an-email"), headers=auth(world.admin)
    )
    assert response.status_code == 422
    assert "email" in response.json()["error"]["details"]["fields"]


def test_departments_show_their_head(client, world):
    departments = client.get(f"{API}/departments", headers=auth(world.employee)).json()
    heads = {d["name"]: d["head"] and d["head"]["full_name"] for d in departments}
    assert heads == {"Engineering": "Manager", "IT": "IT Manager", "People & Culture": None}

    denied = client.patch(
        f"{API}/departments/{world.people.id}",
        json={"head_id": world.admin.id},
        headers=auth(world.manager),
    )
    assert denied.status_code == 403


def test_deactivation_is_never_blocked_and_reports_open_work(client, world, db):
    from app.modules.requests.models import RequestCategory, RequestPriority, ServiceRequest

    category = RequestCategory(name="IT Equipment", description="Hardware")
    db.add(category)
    db.flush()
    db.add(
        ServiceRequest(
            title="Laptop screen is cracked",
            description="Dropped it",
            category_id=category.id,
            priority=RequestPriority.HIGH,
            status="ASSIGNED",
            requester_id=world.employee.id,
            assignee_id=world.it_engineer.id,
        )
    )
    db.flush()
    response = client.patch(
        f"{API}/users/{world.it_engineer.id}", json={"is_active": False}, headers=auth(world.admin)
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert response.json()["open_items"] == 1


def test_reporting_line_cannot_loop(client, world):
    # Manager reports to nobody; making Manager report to IT Manager is fine,
    # but then IT Manager cannot report to Manager.
    headers = auth(world.admin)
    first = client.patch(
        f"{API}/users/{world.manager.id}", json={"manager_id": world.it_manager.id}, headers=headers
    )
    assert first.status_code == 200
    loop = client.patch(
        f"{API}/users/{world.it_manager.id}", json={"manager_id": world.manager.id}, headers=headers
    )
    assert loop.status_code == 422


def test_department_head_must_manage_in_that_department(client, world):
    headers = auth(world.admin)
    url = f"{API}/departments/{world.it.id}"
    outsider = client.patch(url, json={"head_id": world.manager.id}, headers=headers)
    not_a_manager = client.patch(url, json={"head_id": world.it_engineer.id}, headers=headers)
    assert outsider.status_code == not_a_manager.status_code == 422
    assert (
        client.patch(url, json={"head_id": world.it_manager.id}, headers=headers).status_code == 200
    )


def test_null_values_in_an_update_are_ignored_not_crashes(client, world):
    body = {"role": None, "country": None, "department_id": None, "is_active": None}
    response = client.patch(
        f"{API}/users/{world.employee.id}", json=body, headers=auth(world.admin)
    )
    assert response.status_code == 200
    assert response.json()["role"] == "EMPLOYEE"
    # A null manager is meaningful: it removes the manager.
    cleared = client.patch(
        f"{API}/users/{world.employee.id}", json={"manager_id": None}, headers=auth(world.admin)
    )
    assert cleared.json()["manager"] is None

    moved = client.patch(
        f"{API}/users/{world.employee.id}",
        json={"manager_id": world.it_manager.id, "department_id": world.it.id, "country": "cy"},
        headers=auth(world.admin),
    ).json()
    assert (moved["manager"]["full_name"], moved["department"]["name"]) == ("IT Manager", "IT")
    assert moved["country"]["code"] == "CY"


def test_head_pointer_does_not_outlive_the_role_or_the_department(client, world, db):
    headers = auth(world.admin)
    world.it_engineer.manager_id = world.manager.id
    db.flush()
    client.patch(f"{API}/users/{world.it_manager.id}", json={"role": "EMPLOYEE"}, headers=headers)
    client.patch(
        f"{API}/users/{world.manager.id}", json={"department_id": world.it.id}, headers=headers
    )
    departments = client.get(f"{API}/departments", headers=headers).json()
    assert {d["name"]: d["head"] for d in departments} == {
        "Engineering": None,
        "IT": None,
        "People & Culture": None,
    }


def test_password_longer_than_bcrypt_allows_is_rejected_cleanly(client, world):
    long_bytes = new_user(world, password="é" * 40)
    assert (
        client.post(f"{API}/users", json=long_bytes, headers=auth(world.admin)).status_code == 422
    )


def test_nobody_can_be_their_own_manager(client, world):
    response = client.patch(
        f"{API}/users/{world.manager.id}",
        json={"manager_id": world.manager.id},
        headers=auth(world.admin),
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "password",
    ["", "        ", "1", "12345678", "password", " Welcome@2026", "Welcome@2026 ", "x" * 80],
)
def test_weak_or_malformed_passwords_are_rejected(password, client, world):
    body = new_user(world, password=password)
    assert client.post(f"{API}/users", json=body, headers=auth(world.admin)).status_code == 422


def test_accepted_password_can_sign_in(client, world):
    body = new_user(world, password="Rainy day 42")
    assert client.post(f"{API}/users", json=body, headers=auth(world.admin)).status_code == 201
    login = client.post(
        "/api/v1/auth/login", json={"email": body["email"], "password": "Rainy day 42"}
    )
    assert login.status_code == 200


@pytest.mark.parametrize("field", ["full_name", "job_title"])
def test_text_of_only_spaces_is_rejected(field, client, world):
    body = new_user(world, **{field: "     "})
    assert client.post(f"{API}/users", json=body, headers=auth(world.admin)).status_code == 422


def test_search_treats_percent_and_underscore_as_plain_text(client, world):
    headers = auth(world.admin)
    assert client.get(f"{API}/users?search=%25", headers=headers).json()["total"] == 0
    assert client.get(f"{API}/users?search=_", headers=headers).json()["total"] == 0
    assert client.get(f"{API}/users?search=employ", headers=headers).json()["total"] == 1


def test_joining_date_must_be_plausible(client, world):
    for joined in ("1800-01-01", "2999-01-01"):
        response = client.post(
            f"{API}/users", json=new_user(world, joining_date=joined), headers=auth(world.admin)
        )
        assert response.status_code == 422
        assert response.json()["error"]["details"]["fields"] == {
            "joining_date": "Joining date must be between the year 2000 and one year from today"
        }


def test_admin_cannot_change_their_own_role(client, world):
    url = f"{API}/users/{world.admin.id}"
    refused = client.patch(url, json={"role": "EMPLOYEE"}, headers=auth(world.admin))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "OWN_ROLE"
    same_role = {"role": "HR_ADMIN", "job_title": "Head of People"}
    assert client.patch(url, json=same_role, headers=auth(world.admin)).status_code == 200


def test_disabling_an_account_reports_who_still_reports_to_it(client, world):
    admin = auth(world.admin)
    url = f"{API}/users/{world.manager.id}"
    reply = client.patch(url, json={"is_active": False}, headers=admin)
    assert reply.json()["direct_reports"] == 2

    assert names(client.get(f"{API}/users?is_active=false", headers=admin)) == {"Manager"}
    assert client.get(f"{API}/users?is_active=true", headers=admin).json()["total"] == 5

    # Other details still save while the person's manager is disabled.
    renamed = client.patch(
        f"{API}/users/{world.employee.id}",
        json={"full_name": "Employee One", "manager_id": world.manager.id},
        headers=admin,
    )
    assert renamed.status_code == 200


def test_manager_lookup_offers_only_people_who_can_manage(client, world):
    found = client.get(f"{API}/users/lookup?managing=true", headers=auth(world.admin)).json()
    assert {u["full_name"] for u in found} == {"Admin", "Manager", "IT Manager"}


def test_admin_sets_a_new_password_for_someone_who_forgot_theirs(client, world):
    url = f"{API}/users/{world.employee.id}/password"
    session = auth(world.employee)
    body = {"new_password": "Reset@2027"}
    assert client.post(url, json=body, headers=auth(world.manager)).status_code == 403
    weak = client.post(url, json={"new_password": "weak"}, headers=auth(world.admin))
    assert weak.status_code == 422

    assert client.post(url, json=body, headers=auth(world.admin)).status_code == 204
    assert client.get(f"{API}/auth/me", headers=session).status_code == 401
    login = {"email": world.employee.email, "password": "Reset@2027"}
    assert client.post(f"{API}/auth/login", json=login).status_code == 200

    own_url = f"{API}/users/{world.admin.id}/password"
    own = client.post(own_url, json=body, headers=auth(world.admin))
    assert own.json()["error"]["code"] == "OWN_PASSWORD"


def test_admin_cannot_disable_their_own_sign_in(client, world):
    url = f"{API}/users/{world.admin.id}"
    refused = client.patch(url, json={"is_active": False}, headers=auth(world.admin))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "OWN_ACCOUNT"


def test_only_an_hr_admin_creates_accounts_of_any_role(client, world):
    body = new_user(world, role="HR_ADMIN", email="second.admin@example.test")
    for user in (world.manager, world.employee):
        assert client.post(f"{API}/users", json=body, headers=auth(user)).status_code == 403
    created = client.post(f"{API}/users", json=body, headers=auth(world.admin))
    assert created.status_code == 201
    assert created.json()["role"] == "HR_ADMIN"


def test_fields_that_cannot_be_edited_are_refused_not_ignored(client, world):
    url = f"{API}/users/{world.employee.id}"
    refused = client.patch(url, json={"email": "new@example.test"}, headers=auth(world.admin))
    assert refused.status_code == 422
    assert refused.json()["error"]["details"]["fields"] == {"email": "Email cannot be changed here"}


def test_a_date_one_year_ahead_is_the_last_one_allowed(client, world):
    from datetime import date, timedelta

    url = f"{API}/users/{world.employee.id}"
    last = date.today() + timedelta(days=365)
    ok = client.patch(url, json={"joining_date": last.isoformat()}, headers=auth(world.admin))
    assert ok.status_code == 200
    late = {"joining_date": (last + timedelta(days=1)).isoformat()}
    assert client.patch(url, json=late, headers=auth(world.admin)).status_code == 422
