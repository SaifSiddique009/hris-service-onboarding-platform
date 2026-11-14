"""Seed the database with demo data: python -m app.seed [--reset]"""

import random
import sys
from datetime import date

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app import models  # noqa: F401
from app.core.db import Base, SessionLocal
from app.modules.users.models import User
from app.seed.onboarding import seed_onboarding
from app.seed.people import seed_people
from app.seed.requests import seed_requests


def seed_all(db: Session, today: date) -> dict[str, int]:
    # A fixed random seed gives the same data on every run; dates follow today.
    rng = random.Random(2026)
    users = seed_people(db, today, rng)
    requests = seed_requests(db, users, today, rng)
    onboardings = seed_onboarding(db, users, today, rng)
    db.commit()
    return {"employees": len(users), "service requests": requests, "onboardings": onboardings}


def main() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            if "--reset" not in sys.argv:
                print("Database already has data. Use --reset to wipe and seed again.")
                return
            tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
            db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        counts = seed_all(db, date.today())
        print("Seeded " + ", ".join(f"{n} {name}" for name, n in counts.items()) + ".")


if __name__ == "__main__":
    main()
