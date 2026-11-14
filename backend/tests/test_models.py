from sqlalchemy.orm import configure_mappers

from app import models  # noqa: F401


def test_all_mappings_are_valid():
    configure_mappers()
