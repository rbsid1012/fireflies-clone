"""One error shape for the whole API: {"detail": "...", "code": "..."}."""
import re

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

_STATUS_CODES = {
    400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found",
    405: "method_not_allowed", 409: "conflict", 413: "payload_too_large",
    422: "validation_error", 501: "not_implemented", 502: "upstream_error",
}


class AppError(Exception):
    def __init__(self, status_code: int, code: str, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.detail = detail


class NotFoundError(AppError):
    def __init__(self, what: str):
        super().__init__(404, "not_found", f"{what} not found")


class ValidationFailed(AppError):
    def __init__(self, detail: str, code: str = "validation_error"):
        super().__init__(422, code, detail)


def _body(detail: str, code: str) -> dict[str, str]:
    return {"detail": detail, "code": code}


_MIN_ONE = re.compile(r"^String should have at least 1 character$")


def _friendly(msg: str) -> str:
    """Pydantic's wording leaks implementation details ("Value error, ..."); say it the way a user would."""
    msg = str(msg).removeprefix("Value error, ")
    if msg == "Field required" or _MIN_ONE.match(msg):
        return "This field is required"
    return msg


def _format_errors(errors: list[dict]) -> str:
    parts = []
    for err in errors:
        loc = ".".join(str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path"))
        msg = _friendly(err.get("msg", ""))
        parts.append(f"{loc}: {msg}" if loc else msg)
    return "; ".join(parts) or "Invalid request"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.detail, exc.code), status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = _STATUS_CODES.get(exc.status_code, "error")
        return JSONResponse(_body(str(exc.detail), code), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _request_validation(_: Request, exc: RequestValidationError):
        detail = _format_errors(jsonable_encoder(exc.errors()))
        return JSONResponse(_body(detail, "validation_error"), status_code=422)

    @app.exception_handler(ValidationError)
    async def _model_validation(_: Request, exc: ValidationError):
        detail = _format_errors(jsonable_encoder(exc.errors()))
        return JSONResponse(_body(detail, "validation_error"), status_code=422)
