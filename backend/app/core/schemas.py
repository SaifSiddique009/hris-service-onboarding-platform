from datetime import date, timedelta
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, field_validator

T = TypeVar("T")
# Characters that take no space on screen, so text made only of them looks empty. NUL is
# here too: PostgreSQL cannot store it in text.
INVISIBLE = dict.fromkeys(map(ord, "\x00\u200b\u200c\u200d\u2060\ufeff"))


def _plausible(value: date) -> date:
    if not date(2000, 1, 1) <= value <= date.today() + timedelta(days=365):
        raise ValueError("must be between the year 2000 and one year from today")
    return value


PlausibleDate = Annotated[date, AfterValidator(_plausible)]


def contains(column, text: str):
    """Case-insensitive "contains", with % and _ in the text treated as plain characters."""
    text = text.translate(INVISIBLE)
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return column.ilike(f"%{escaped}%", escape="\\")


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class In(BaseModel):
    """Base for request bodies: surrounding spaces never count as content."""

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("*", mode="before")
    @classmethod
    def drop_invisible(cls, value):
        return value.translate(INVISIBLE) if isinstance(value, str) else value


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
