"""Global exception handling (docs/ARCHITECTURE.md §6): every response,
success or failure, follows the AWS envelope
`{Error: {Type, Code, Message}, RequestId}` (docs/ROUTE53-DOMAIN-RULES.md
§12, docs/API.md §9). Registered from `app.main` per the architecture doc;
kept here so `main.py` stays a thin assembly point.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import Route53Error
from app.core.request_id import get_request_id

logger = logging.getLogger("app.errors")

_GENERIC_HTTP_CODES: dict[int, str] = {
    401: "NotAuthorized",
    403: "NotAuthorized",
    404: "NotFound",
    405: "InvalidInput",
}


def _envelope(error_type: str, code: str, message: str, request_id: str) -> dict[str, object]:
    return {
        "Error": {"Type": error_type, "Code": code, "Message": message},
        "RequestId": request_id,
    }


def _validation_message(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Invalid request."
    first = errors[0]
    field = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    detail = str(first.get("msg", "Invalid request."))
    return f"{field}: {detail}" if field else detail


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(Route53Error)
    async def _route53_error(request: Request, exc: Route53Error) -> JSONResponse:
        error_type = "Sender" if exc.http_status < 500 else "Receiver"
        return JSONResponse(
            status_code=exc.http_status,
            content=_envelope(error_type, exc.aws_code, exc.message, get_request_id(request)),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_envelope(
                "Sender", "ValidationError", _validation_message(exc), get_request_id(request)
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code >= 500:
            error_type, code = "Receiver", "InternalError"
        else:
            error_type = "Sender"
            code = _GENERIC_HTTP_CODES.get(exc.status_code, "InvalidInput")
        message = str(exc.detail) if exc.detail else "Request failed."
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(error_type, code, message, get_request_id(request)),
        )

    @app.exception_handler(Exception)
    async def _unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        request_id = get_request_id(request)
        logger.exception("Unhandled exception (request_id=%s)", request_id)
        return JSONResponse(
            status_code=500,
            content=_envelope(
                "Receiver", "InternalError", "An internal error occurred.", request_id
            ),
        )
