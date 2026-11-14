import os

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres@localhost:5432/hris_test"
)
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256"

from datetime import date  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.exc import DataError
from sqlalchemy.orm import Session  # noqa: E402

from app import models  # noqa: E402, F401
from app.core.db import Base, engine, get_db  # noqa: E402
from app.core.security import create_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.users.models import (  # noqa: E402
    Country,
    Department,
    EmploymentStatus,
    User,
    UserRole,
)

PASSWORD = "Welcome@2026"
PASSWORD_HASH = hash_password(PASSWORD)


@pytest.fixture(scope="session", autouse=True)
def schema():
    assert engine.url.database.endswith("_test"), "tests must run against a *_test database"
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


@pytest.fixture
def db():
    # Each test runs inside one outer transaction that is rolled back at the end.
    connection = engine.connect()
    outer = connection.begin()
    session = Session(connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    yield session
    session.close()
    outer.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def shared():
        try:
            yield db
        except DataError:
            # A real request owns its session and drops it; the shared one has to be reset.
            db.rollback()
            raise

    app.dependency_overrides[get_db] = shared
    yield TestClient(app)
    app.dependency_overrides.clear()


class World:
    """A small organisation: one admin, two managers and their reports, in two departments."""

    def __init__(self, db: Session):
        self.db = db
        db.add_all(
            [
                Country(code="BD", name="Bangladesh", timezone="Asia/Dhaka"),
                Country(code="CY", name="Cyprus", timezone="Asia/Nicosia"),
            ]
        )
        self.engineering = Department(name="Engineering")
        self.it = Department(name="IT")
        self.people = Department(name="People & Culture")
        db.add_all([self.engineering, self.it, self.people])
        db.flush()

        self.admin = self.user("Admin", UserRole.HR_ADMIN, self.people)
        self.manager = self.user("Manager", UserRole.MANAGER, self.engineering)
        self.it_manager = self.user("IT Manager", UserRole.MANAGER, self.it, country="CY")
        self.employee = self.user("Employee", UserRole.EMPLOYEE, self.engineering, self.manager)
        self.colleague = self.user("Colleague", UserRole.EMPLOYEE, self.engineering, self.manager)
        self.it_engineer = self.user("IT Engineer", UserRole.EMPLOYEE, self.it, self.it_manager)
        self.it.head_id = self.it_manager.id
        self.engineering.head_id = self.manager.id
        db.flush()

    def user(self, name, role, department, manager=None, country="BD", **extra) -> User:
        user = User(
            full_name=name,
            email=f"{name.lower().replace(' ', '.')}@example.test",
            password_hash=PASSWORD_HASH,
            job_title=name,
            role=role,
            country_code=country,
            department_id=department.id,
            manager_id=manager.id if manager else None,
            status=EmploymentStatus.ACTIVE,
            joining_date=date(2024, 1, 15),
            **extra,
        )
        self.db.add(user)
        self.db.flush()
        return user


@pytest.fixture
def world(db) -> World:
    return World(db)


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {create_token(user.id, user.token_version)}"}
