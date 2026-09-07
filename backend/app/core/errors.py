"""Route53Error — the typed domain exception (docs/ROUTE53-DOMAIN-RULES.md §12).

Services raise this carrying the AWS error code and HTTP status; the
global exception handler (Phase 2) renders the AWS envelope. Services
never touch HTTP constructs themselves.
"""

from __future__ import annotations

from typing import Final


class Route53Error(Exception):
    """A Route 53 domain-rule violation with its AWS error code and message."""

    def __init__(self, code: str, message: str, http_status: int) -> None:
        super().__init__(message)
        self.aws_code = code
        self.message = message
        self.http_status = http_status


# Common violation constructors, keyed by the AWS error codes in docs/API.md §9.

INVALID_CHANGE_BATCH: Final = "InvalidChangeBatch"
INVALID_INPUT: Final = "InvalidInput"
NOT_AUTHORIZED: Final = "NotAuthorized"
NO_SUCH_HOSTED_ZONE: Final = "NoSuchHostedZone"
NO_SUCH_RECORD: Final = "NoSuchRecord"
NO_SUCH_CHANGE: Final = "NoSuchChange"
HOSTED_ZONE_NOT_EMPTY: Final = "HostedZoneNotEmpty"
HOSTED_ZONE_ALREADY_EXISTS: Final = "HostedZoneAlreadyExists"


def invalid_change_batch(message: str) -> Route53Error:
    return Route53Error(INVALID_CHANGE_BATCH, message, 400)


def invalid_input(message: str) -> Route53Error:
    return Route53Error(INVALID_INPUT, message, 400)


def not_authorized(message: str) -> Route53Error:
    return Route53Error(NOT_AUTHORIZED, message, 401)


def no_such_hosted_zone(zone_id: str) -> Route53Error:
    return Route53Error(NO_SUCH_HOSTED_ZONE, f"No hosted zone found with id {zone_id}.", 404)


def no_such_record(record_id: str) -> Route53Error:
    return Route53Error(NO_SUCH_RECORD, f"No record set found with id {record_id}.", 404)


def no_such_change(change_id: str) -> Route53Error:
    return Route53Error(NO_SUCH_CHANGE, f"No change batch found with id {change_id}.", 404)


def hosted_zone_not_empty() -> Route53Error:
    return Route53Error(
        HOSTED_ZONE_NOT_EMPTY,
        "Hosted Zone is not empty. Delete all non-default record sets before "
        "deleting the hosted zone.",
        400,
    )


def hosted_zone_already_exists(name: str, zone_type: str) -> Route53Error:
    return Route53Error(
        HOSTED_ZONE_ALREADY_EXISTS,
        f"A hosted zone with name {name} and type {zone_type} already exists for this account.",
        409,
    )
