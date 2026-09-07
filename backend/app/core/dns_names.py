"""DNS name normalisation and zone-membership rules.

docs/ROUTE53-DOMAIN-RULES.md R5: names normalize to lowercase fully
qualified names with a trailing dot; bare ``@`` maps to the apex; relative
single-label names get the zone suffix appended; IDN names are handled
via IDNA encoding; wildcards are legal names. Round-trip safe:
``normalise(normalise(x)) == normalise(x)``.
"""

from __future__ import annotations

import re
from typing import Final

ASCII_LABEL: Final = re.compile(r"^[a-z0-9_*-]+$")
FQDN_MAX_LENGTH: Final = 253  # excluding the trailing dot


class InvalidName(ValueError):
    """Raised for names that cannot be normalised into a legal DNS name."""


def _normalise_label(label: str) -> str:
    if not label:
        raise InvalidName("DNS names must not contain empty labels.")
    lowered = label.lower()
    if all(ord(c) < 128 for c in lowered):
        encoded = lowered
    else:
        try:
            encoded = lowered.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise InvalidName(f"Label {label!r} is not representable in IDNA.") from exc
    if len(encoded) > 63:
        raise InvalidName(f"Label {label!r} exceeds 63 characters.")
    if not ASCII_LABEL.fullmatch(encoded):
        raise InvalidName(
            f"Label {label!r} may only contain letters, digits, hyphens, "
            "underscores, or a leading wildcard."
        )
    if encoded.startswith("-") or encoded.endswith("-"):
        raise InvalidName(f"Label {label!r} must not start or end with a hyphen.")
    return encoded


def normalise(name: str, *, zone: str | None = None) -> str:
    """Normalise a DNS name to a lowercase FQDN with a trailing dot.

    With ``zone`` given, R5 record-name semantics apply: ``@`` maps to the
    zone apex and a dotless name is treated as relative to the zone.
    """
    trimmed = name.strip()
    if not trimmed:
        raise InvalidName("DNS name must not be empty.")
    if trimmed.startswith("@"):
        if zone is None:
            raise InvalidName("DNS name must not start with '@'.")
        trimmed = trimmed[1:]
        if trimmed in ("", "."):
            return zone
        raise InvalidName("Only the bare '@' maps to the zone apex.")

    if zone is not None and not trimmed.endswith("."):
        trimmed = f"{trimmed}.{zone}"

    body = trimmed[:-1] if trimmed.endswith(".") else trimmed
    labels = [_normalise_label(label) for label in body.split(".")]
    fqdn = ".".join(labels) + "."
    if len(fqdn) - 1 > FQDN_MAX_LENGTH:
        raise InvalidName(f"DNS name {name!r} exceeds 253 characters.")
    return fqdn


def normalise_zone_name(name: str) -> str:
    """Zone names are ordinary FQDNs; single-label zones are rejected the
    way real Route 53 rejects them."""
    fqdn = normalise(name)
    if fqdn.count(".") < 2:
        raise InvalidName("Invalid domain name.")
    return fqdn


def is_within_zone(record_name: str, zone_name: str) -> bool:
    """True when a normalised record name equals the zone apex or sits
    inside it. Both arguments must already be normalised."""
    return record_name == zone_name or record_name.endswith(f".{zone_name}")


HOSTNAME_LABEL: Final = re.compile(r"^[a-z0-9*-]+$")


def normalise_hostname(value: str) -> str:
    """Normalise an rdata hostname value: strict hostname charset (no
    underscores, since these are host names, not owner names), optional
    trailing dot, IDNA encoded, returned as an FQDN."""
    trimmed = value.strip()
    if not trimmed:
        raise InvalidName("Hostname must not be empty.")
    lowered = trimmed.lower()
    labels = lowered[:-1].split(".") if lowered.endswith(".") else lowered.split(".")
    for label in labels:
        if not label:
            raise InvalidName(f"Hostname {value!r} must not contain empty labels.")
        if all(ord(c) < 128 for c in label):
            encoded = label
        else:
            try:
                encoded = label.encode("idna").decode("ascii")
            except UnicodeError as exc:
                raise InvalidName(f"Hostname {value!r} is not representable in IDNA.") from exc
        if len(encoded) > 63:
            raise InvalidName(f"Hostname {value!r} has a label exceeding 63 characters.")
        if not HOSTNAME_LABEL.fullmatch(encoded):
            raise InvalidName(f"Hostname {value!r} may only contain letters, digits, and hyphens.")
        if encoded.startswith("-") or encoded.endswith("-"):
            raise InvalidName(f"Hostname {value!r} has a label starting or ending with a hyphen.")
    fqdn = ".".join(labels) + "."
    if len(fqdn) - 1 > FQDN_MAX_LENGTH:
        raise InvalidName(f"Hostname {value!r} exceeds 253 characters.")
    return fqdn
