"""AWS error envelope shape (docs/ROUTE53-DOMAIN-RULES.md §12, docs/API.md §9)."""

from __future__ import annotations

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    Type: str
    Code: str
    Message: str


class ErrorEnvelope(BaseModel):
    Error: ErrorDetail
    RequestId: str
