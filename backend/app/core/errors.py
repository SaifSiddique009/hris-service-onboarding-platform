from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError
from starlette.exceptions import HTTPException


class AppError(Exception):
    status = 400
    code = "BAD_REQUEST"

    def __init__(self, message: str, code: str | None = None, details: dict | None = None):
        self.message = message
        self.code = code or self.code
        self.details = details or {}


class Unauthorized(AppError):
    status, code = 401, "UNAUTHORIZED"


class Forbidden(AppError):
    status, code = 403, "FORBIDDEN"


class NotFound(AppError):
    status, code = 404, "NOT_FOUND"


class Conflict(AppError):
    status, code = 409, "CONFLICT"


class Invalid(AppError):
    status, code = 422, "VALIDATION_ERROR"


def _body(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def _sentence(error: dict) -> str:
    """One validation problem as a sentence a person can act on."""
    name = next((p for p in reversed(error["loc"]) if isinstance(p, str)), "value")
    field = name.replace("_", " ").capitalize()
    kind = error["type"]
    if kind == "missing":
        return f"{field} is required"
    if kind == "extra_forbidden":
        return f"{field} cannot be changed here"
    if kind in ("string_too_short", "string_too_long"):
        short = kind == "string_too_short"
        limit = error["ctx"]["min_length" if short else "max_length"]
        bound = "at least" if short else "at most"
        return f"{field} must be {bound} {limit} character{'' if limit == 1 else 's'}"
    if kind == "value_error":
        text = error["msg"].removeprefix("Value error, ")
        return f"{field} {text}" if text[:1].islower() else text
    return f"{field} is not valid"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    def app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.code, exc.message, exc.details), exc.status)

    @app.exception_handler(HTTPException)
    def http_error(_: Request, exc: HTTPException):
        return JSONResponse(_body("HTTP_ERROR", str(exc.detail)), exc.status_code)

    @app.exception_handler(DataError)
    def out_of_range(_: Request, __: DataError):
        # A value the database cannot hold, such as an id beyond a 32-bit integer.
        return JSONResponse(_body("VALIDATION_ERROR", "One of the values is not valid"), 422)

    @app.exception_handler(RequestValidationError)
    def validation_error(_: Request, exc: RequestValidationError):
        fields = {".".join(str(p) for p in e["loc"][1:]): _sentence(e) for e in exc.errors()}
        message = ". ".join(dict.fromkeys(fields.values()))
        return JSONResponse(_body("VALIDATION_ERROR", message, {"fields": fields}), 422)
