"""The fixed catalogue of read-only tools the model may call. Each tool is an argument schema
plus one of the report functions the dashboard also uses."""

import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.errors import Invalid
from app.modules.dashboard import service as reports

Role = Literal["EMPLOYEE", "MANAGER", "HR_ADMIN"]
Employment = Literal["ACTIVE", "ON_PROBATION", "ON_NOTICE"]
RequestState = Literal["unresolved", "awaiting_confirmation", "open", "closed"]
RequestStatus = Literal["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]
Priority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]
COUNTRY = Field(None, description="Country name or two-letter code")


class Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CountEmployees(Args):
    """Count active employees, optionally filtered and grouped."""

    country: str | None = COUNTRY
    department: str | None = None
    role: Role | None = None
    status: Employment | None = None
    group_by: Literal["country", "department", "role", "status"] | None = None


class RequestFilters(Args):
    state: RequestState | None = Field(
        None,
        description="unresolved = submitted, assigned or in progress; awaiting_confirmation = "
        "resolved; open = unresolved plus awaiting confirmation; closed = closed",
    )
    status: RequestStatus | None = None
    category: str | None = None
    priority: Priority | None = None
    country: str | None = COUNTRY


class CountServiceRequests(RequestFilters):
    """Count service requests, optionally filtered and grouped."""

    group_by: Literal["status", "category", "priority", "country"] | None = None


class ListServiceRequests(RequestFilters):
    """List service requests, newest first. Titles of confidential requests are withheld."""

    limit: int = Field(20, ge=1, le=20)


class OnboardingProgress(Args):
    """Progress of each new hire's onboarding: tasks completed, in progress, blocked, overdue."""

    country: str | None = COUNTRY
    active_only: bool = False


class ListOnboardingTasks(Args):
    """List onboarding tasks in one state, with the new hire, owner, assignee and due date."""

    state: Literal["overdue", "blocked", "in_progress", "not_started", "completed"]
    country: str | None = COUNTRY
    department: str | None = Field(None, description="Department that owns the task")
    limit: int = Field(20, ge=1, le=20)


class NewHiresWithOpenRequests(Args):
    """New hires still in onboarding who have open service requests."""

    category: str | None = None


TOOLS = {
    "count_employees": (CountEmployees, reports.count_employees),
    "count_service_requests": (CountServiceRequests, reports.count_service_requests),
    "list_service_requests": (ListServiceRequests, reports.list_service_requests),
    "onboarding_progress": (OnboardingProgress, reports.onboarding_progress),
    "list_onboarding_tasks": (ListOnboardingTasks, reports.list_onboarding_tasks),
    "new_hires_with_open_requests": (
        NewHiresWithOpenRequests,
        reports.new_hires_with_open_requests,
    ),
}


def _compact(schema):
    """Drop what the model does not need: titles, and the null half of optional fields."""
    if isinstance(schema, list):
        return [_compact(item) for item in schema]
    if not isinstance(schema, dict):
        return schema
    options = [o for o in schema.get("anyOf", []) if o != {"type": "null"}]
    if len(options) == 1:
        schema = {k: v for k, v in schema.items() if k not in ("anyOf", "default")} | options[0]
    return {key: _compact(value) for key, value in schema.items() if key != "title"}


SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": name,
            "description": args.__doc__,
            "parameters": _compact(args.model_json_schema()),
        },
    }
    for name, (args, _) in TOOLS.items()
]


class ToolError(Exception):
    pass


def run(db: Session, name: str, raw_arguments: str) -> tuple[dict, object, list[dict]]:
    """Validate the model's arguments and run the tool. Returns (arguments, result, rows)."""
    if name not in TOOLS:
        raise ToolError(f"Unknown tool '{name}'. Available: {', '.join(TOOLS)}")
    schema, function = TOOLS[name]
    try:
        arguments = schema.model_validate(json.loads(raw_arguments or "{}"))
        result = function(db, **arguments.model_dump(exclude_none=True))
    except (ValueError, ValidationError, Invalid) as error:
        raise ToolError(getattr(error, "message", str(error))) from None
    if isinstance(result, dict):
        rows = result.get("groups") or [{"total": result["total"]}]
    else:
        rows = result
    return arguments.model_dump(exclude_none=True, exclude_defaults=True), result, rows
