"""Typed API errors.

Engineering spec §29 requires errors to be distinguishable rather than a
generic 500, so the frontend can show a human-readable explanation and the AI
layer can tell "this could not be calculated" apart from "this is unknown".

Spec §22 also requires that internal detail never leak to the client. So each
handler decides deliberately whether its message is one we authored (safe to
show) or an internal string that must be replaced with a generic one and only
logged.
"""

from __future__ import annotations

import logging
import uuid
from enum import Enum

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.domain.birth_data import InvalidBirthDataError
from app.services.astrology.common.ephemeris import EphemerisError

logger = logging.getLogger("celestara.api")


class ErrorCode(str, Enum):
    """The error vocabulary from engineering spec §29."""

    INVALID_BIRTH_DATA = "INVALID_BIRTH_DATA"
    CALCULATION_ERROR = "CALCULATION_ERROR"
    UNSUPPORTED_CONFIGURATION = "UNSUPPORTED_CONFIGURATION"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorResponse(BaseModel):
    """Every failure returns this shape."""

    code: ErrorCode
    message: str
    """Safe to display to a user as-is."""

    field_errors: tuple[dict[str, str], ...] = ()
    """Per-field problems, when the failure was request validation."""

    request_id: str
    """Correlates this response with server logs (engineering spec §32)."""


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _response(
    request: Request,
    status_code: int,
    code: ErrorCode,
    message: str,
    field_errors: tuple[dict[str, str], ...] = (),
) -> JSONResponse:
    body = ErrorResponse(
        code=code,
        message=message,
        field_errors=field_errors,
        request_id=_request_id(request),
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


def register_error_handlers(app: FastAPI) -> None:
    """Attach handlers that turn exceptions into typed responses."""

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Pydantic rejected the request body.

        Field paths and messages are echoed back because they describe the
        caller's own input, not our internals.
        """
        field_errors = tuple(
            {
                "field": ".".join(str(part) for part in error["loc"][1:]),
                "message": error["msg"],
            }
            for error in exc.errors()
        )
        return _response(
            request,
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorCode.INVALID_BIRTH_DATA,
            "The birth data could not be accepted. See field_errors.",
            field_errors,
        )

    @app.exception_handler(InvalidBirthDataError)
    async def _invalid_birth_data(
        request: Request, exc: InvalidBirthDataError
    ) -> JSONResponse:
        """Data was well-formed but not resolvable, e.g. an unknown timezone.

        These messages are authored in the domain layer specifically to be
        shown to a user, so they pass through.
        """
        return _response(
            request,
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_BIRTH_DATA,
            str(exc),
        )

    @app.exception_handler(EphemerisError)
    async def _ephemeris_error(
        request: Request, exc: EphemerisError
    ) -> JSONResponse:
        """The calculation engine could not satisfy the request.

        The message is deliberately *not* forwarded: engine errors can contain
        filesystem paths and configuration detail. It is logged with the
        request id instead, so support can correlate without the client ever
        seeing infrastructure internals.
        """
        logger.error(
            "ephemeris failure [request_id=%s]: %s", _request_id(request), exc
        )
        return _response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.CALCULATION_ERROR,
            "The chart could not be calculated. This has been logged; please "
            "try again or contact support with the request id.",
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        """Last resort: never let a stack trace reach the client."""
        logger.exception(
            "unhandled failure [request_id=%s]", _request_id(request)
        )
        return _response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.INTERNAL_ERROR,
            "Something went wrong. This has been logged.",
        )


def new_request_id() -> str:
    return uuid.uuid4().hex


_EXAMPLE_REQUEST_ID = "7f3c1e9a4b2d4f8e9a1c2b3d4e5f6a7b"


def _example(
    code: ErrorCode,
    message: str,
    field_errors: tuple[dict[str, str], ...] = (),
) -> dict[str, object]:
    return {
        "code": code.value,
        "message": message,
        "field_errors": list(field_errors),
        "request_id": _EXAMPLE_REQUEST_ID,
    }


def error_response(
    description: str,
    code: ErrorCode,
    message: str,
    field_errors: tuple[dict[str, str], ...] = (),
) -> dict[str, object]:
    """Build an OpenAPI response entry with a realistic example.

    Without an explicit example, Swagger UI renders `ErrorResponse` by taking
    the *first* member of the `ErrorCode` enum for every status, so a 500 gets
    documented as INVALID_BIRTH_DATA. Supplying the example per status makes
    the docs page match what the endpoint actually returns.
    """
    return {
        "model": ErrorResponse,
        "description": description,
        "content": {
            "application/json": {"example": _example(code, message, field_errors)}
        },
    }


#: Error responses shared by any endpoint that accepts birth data.
BIRTH_DATA_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    400: error_response(
        "Birth data was well-formed but could not be resolved",
        ErrorCode.INVALID_BIRTH_DATA,
        "unknown timezone 'Mars/Olympus_Mons'",
    ),
    422: error_response(
        "Birth data was rejected by validation",
        ErrorCode.INVALID_BIRTH_DATA,
        "The birth data could not be accepted. See field_errors.",
        (
            {
                "field": "birth.latitude",
                "message": "Input should be less than or equal to 90",
            },
        ),
    ),
    500: error_response(
        "The chart could not be calculated",
        ErrorCode.CALCULATION_ERROR,
        "The chart could not be calculated. This has been logged; please try "
        "again or contact support with the request id.",
    ),
}
