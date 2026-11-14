"""Seed the database with demo data: python -m app.seed [--reset]"""

import random
import sys
from datetime import date

from sqlalchemy import func, select, text

from app import models  # noqa: F401
from app.core.db import Base, SessionLocal
from app.modules.users.models import User
from app.seed.people import seed_people


def main() -> None:
    reset = "--reset" in sys.argv
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            if not reset:
                print("Database already has data. Use --reset to wipe and seed again.")
                return
            tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
            db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))

        # A fixed random seed gives the same people on every run; dates follow today.
        users = seed_people(db, date.today(), random.Random(2026))
        db.commit()
        print(f"Seeded {len(users)} employees.")


if __name__ == "__main__":
    main()
