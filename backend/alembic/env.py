from sqlalchemy import create_engine

from alembic import context
from app import models  # noqa: F401
from app.core.config import settings
from app.core.db import Base

url = context.config.get_main_option("sqlalchemy.url") or settings.sqlalchemy_url
with create_engine(url).connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
