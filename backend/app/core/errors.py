from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
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


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    def app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.code, exc.message, exc.details), exc.status)

    @app.exception_handler(HTTPException)
    def http_error(_: Request, exc: HTTPException):
        return JSONResponse(_body("HTTP_ERROR", str(exc.detail)), exc.status_code)

    @app.exception_handler(RequestValidationError)
    def validation_error(_: Request, exc: RequestValidationError):
        fields = {".".join(str(p) for p in e["loc"][1:]): e["msg"] for e in exc.errors()}
        return JSONResponse(_body("VALIDATION_ERROR", "Invalid request", {"fields": fields}), 422)
