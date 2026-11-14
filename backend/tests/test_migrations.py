from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text

from alembic import command
from app import models  # noqa: F401
from app.core.db import Base, engine

DATABASE = "hris_migrations_test"


def test_migrations_build_exactly_the_schema_the_models_describe():
    # The other tests use create_all(); this one proves the migrations give the same result.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as admin:
        admin.execute(text(f"DROP DATABASE IF EXISTS {DATABASE}"))
        admin.execute(text(f"CREATE DATABASE {DATABASE}"))
    url = engine.url.set(database=DATABASE)

    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False))
    command.upgrade(config, "head")

    migrated = create_engine(url)
    with migrated.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    migrated.dispose()
    assert differences == []
