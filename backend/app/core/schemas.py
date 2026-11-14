from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


def contains(column, text: str):
    """Case-insensitive "contains", with % and _ in the text treated as plain characters."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return column.ilike(f"%{escaped}%", escape="\\")


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class In(BaseModel):
    """Base for request bodies: surrounding spaces never count as content."""

    model_config = ConfigDict(str_strip_whitespace=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
