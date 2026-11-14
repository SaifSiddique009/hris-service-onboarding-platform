from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.core.errors import Conflict, Forbidden


@dataclass(frozen=True)
class Action:
    sources: tuple
    target: Any
    allowed: Callable[[Any, Any], bool]


def check_action(actions: dict[str, Action], name: str, row, user) -> Action:
    """409 if the action does not start from the row's status, 403 if this user may not take it."""
    action = actions.get(name)
    if not action or row.status not in action.sources:
        raise Conflict(
            f"'{name}' is not possible while the status is {row.status.value}",
            "INVALID_TRANSITION",
        )
    if not action.allowed(user, row):
        raise Forbidden("You are not allowed to do this")
    return action


def allowed_actions(actions: dict[str, Action], row, user) -> list[str]:
    return [
        name
        for name, action in actions.items()
        if row.status in action.sources and action.allowed(user, row)
    ]
