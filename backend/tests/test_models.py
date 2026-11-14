from sqlalchemy import DateTime
from sqlalchemy.orm import configure_mappers

from app import models  # noqa: F401
from app.core.db import Base


def test_all_mappings_are_valid():
    configure_mappers()


def test_every_timestamp_column_keeps_its_time_zone():
    naive = [
        f"{table.name}.{column.name}"
        for table in Base.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, DateTime) and not column.type.timezone
    ]
    assert naive == []
