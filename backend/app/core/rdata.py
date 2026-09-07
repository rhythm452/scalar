"""Per-type record data (rdata) validators — docs/ROUTE53-DOMAIN-RULES.md R7.

A registry maps record type to a validator callable. Each validator
returns the normalised wire value or raises ``Route53Error`` with code
``InvalidChangeBatch`` and a message naming the type and offending value,
exactly as specified in the R7 table.

NAPTR, SPF, and DS follow BIND conventions; they are best-effort and not
console-verified against the real Route 53 UI.
"""

from __future__ import annotations

import ipaddress
import re
from collections.abc import Callable
from typing import Final

from app.core.dns_names import InvalidName, normalise, normalise_hostname
from app.core.errors import Route53Error, invalid_change_batch

ValueValidator = Callable[[str], str]

U16_MAX: Final = 65535
U32_MAX: Final = 2147483647
TXT_CHUNK_MAX: Final = 255
CAA_TAGS: Final = ("issue", "issuewild", "issuemail", "def_spki")


def _invalid_ip(value: str, kind: str) -> Route53Error:
    return invalid_change_batch(f"Value {value} is not a valid {kind} address.")


def _not_a_hostname(value: str) -> Route53Error:
    return invalid_change_batch(f"Value {value} is not a valid hostname.")


def _hostname(value: str) -> str:
    try:
        return normalise_hostname(value)
    except InvalidName:
        raise _not_a_hostname(value) from None


def _validate_a(value: str) -> str:
    try:
        return str(ipaddress.IPv4Address(value))
    except ValueError:
        raise _invalid_ip(value, "IPv4") from None


def _validate_aaaa(value: str) -> str:
    try:
        return str(ipaddress.IPv6Address(value))
    except ValueError:
        raise _invalid_ip(value, "IPv6") from None


def _validate_txt(value: str) -> str:
    """TXT/SPF: one or more quoted strings, each chunk at most 255 chars,
    backslash escaping handled inside quotes."""

    def fail() -> Route53Error:
        return invalid_change_batch(
            "TXT strings must be quoted with max 255 characters per string."
        )

    chunks: list[str] = []
    i = 0
    while i < len(value):
        if value[i] != '"':
            raise fail()
        i += 1
        chunk_chars: list[str] = []
        while True:
            if i >= len(value):
                raise fail()
            char = value[i]
            if char == "\\" and i + 1 < len(value):
                chunk_chars.append(value[i : i + 2])
                i += 2
                continue
            if char == '"':
                break
            chunk_chars.append(char)
            i += 1
        i += 1
        if len("".join(chunk_chars)) > TXT_CHUNK_MAX:
            raise fail()
        chunks.append("".join(chunk_chars))
        if i < len(value):
            if value[i] != " ":
                raise fail()
            i += 1
            if i >= len(value) or value[i] != '"':
                raise fail()
    if not chunks:
        raise fail()
    return " ".join(f'"{chunk}"' for chunk in chunks)


def _split_fields(value: str, count: int) -> list[str]:
    fields = value.split()
    if len(fields) != count:
        return []
    return fields


def _int_in_range(field: str, low: int, high: int) -> int | None:
    try:
        number = int(field, 10)
    except ValueError:
        return None
    if not low <= number <= high:
        return None
    return number


def _validate_mx(value: str) -> str:
    """R7's table gives one message for every MX failure; unlike CNAME/NS/
    PTR, a bad hostname here must not leak _hostname()'s own message (the
    way SRV and NAPTR also normalise their embedded hostname failures)."""

    def fail() -> Route53Error:
        return invalid_change_batch('MX value must be in the format "<priority> <hostname>".')

    fields = _split_fields(value, 2)
    if not fields:
        raise fail()
    preference = _int_in_range(fields[0], 0, U16_MAX)
    if preference is None:
        raise fail()
    try:
        hostname = normalise_hostname(fields[1])
    except InvalidName:
        raise fail() from None
    return f"{preference} {hostname}"


def _validate_srv(value: str) -> str:
    def fail() -> Route53Error:
        return invalid_change_batch(
            'SRV value must be in the format "<priority> <weight> <port> <target>".'
        )

    fields = _split_fields(value, 4)
    if not fields:
        raise fail()
    numbers = [_int_in_range(f, 0, U16_MAX) for f in fields[:3]]
    if any(n is None for n in numbers):
        raise fail()
    target = fields[3]
    if target != ".":
        try:
            target = normalise_hostname(target)
        except InvalidName:
            raise fail() from None
    return f"{numbers[0]} {numbers[1]} {numbers[2]} {target}"


def _validate_caa(value: str) -> str:
    def fail() -> Route53Error:
        return invalid_change_batch('CAA value must be in the format "<flags> <tag> <value>".')

    fields = value.split(maxsplit=2)
    if len(fields) != 3:
        raise fail()
    flags = _int_in_range(fields[0], 0, 255)
    if flags is None:
        raise fail()
    tag = fields[1].lower()
    if tag not in CAA_TAGS:
        raise fail()
    target = fields[2].strip()
    if len(target) >= 2 and target.startswith('"') and target.endswith('"'):
        target = target[1:-1]
    if not target or '"' in target:
        raise fail()
    return f'{flags} {tag} "{target}"'


def _validate_soa(value: str) -> str:
    def fail() -> Route53Error:
        return invalid_change_batch(
            "SOA value must be in the format "
            '"<mname> <rname> <serial> <refresh> <retry> <expire> <minimum>".'
        )

    fields = _split_fields(value, 7)
    if not fields:
        raise fail()
    try:
        mname = normalise_hostname(fields[0])
        rname = normalise_hostname(fields[1])
    except InvalidName:
        raise fail() from None
    numbers = [_int_in_range(f, 0, U32_MAX) for f in fields[2:]]
    if any(n is None for n in numbers):
        raise fail()
    return " ".join([mname, rname, *(str(n) for n in numbers)])


def _split_quoted(value: str) -> list[str] | None:
    """Split a value into whitespace-separated fields where double-quoted
    fields may contain spaces. Returns None when the quoting is malformed."""
    fields: list[str] = []
    i = 0
    length = len(value)
    while i < length:
        if value[i].isspace():
            i += 1
            continue
        if value[i] == '"':
            i += 1
            start = i
            while i < length and value[i] != '"':
                if value[i] == "\\" and i + 1 < length:
                    i += 1
                i += 1
            if i >= length:
                return None
            fields.append(value[start:i])
            i += 1
        else:
            start = i
            while i < length and not value[i].isspace():
                i += 1
            fields.append(value[start:i])
    return fields


def _validate_naptr(value: str) -> str:
    """Best-effort BIND convention: order preference flags service regexp
    replacement, with flags/service/regexp quoted and replacement a domain
    name (underscores legal, e.g. ``_sip._udp.example.com.``)."""

    def fail() -> Route53Error:
        return invalid_change_batch("NAPTR value is malformed.")

    fields = _split_quoted(value)
    if fields is None or len(fields) != 6:
        raise fail()
    order = _int_in_range(fields[0], 0, U16_MAX)
    preference = _int_in_range(fields[1], 0, U16_MAX)
    if order is None or preference is None:
        raise fail()
    flags, service, regexp, replacement = fields[2], fields[3], fields[4], fields[5]
    if replacement != ".":
        try:
            replacement = normalise(replacement)
        except InvalidName:
            raise fail() from None
    return " ".join(
        [str(order), str(preference), f'"{flags}"', f'"{service}"', f'"{regexp}"', replacement]
    )


HEX_RE: Final = re.compile(r"^[0-9a-fA-F]+$")


def _validate_ds(value: str) -> str:
    """Best-effort BIND convention: keytag algorithm digesttype digest-hex."""

    def fail() -> Route53Error:
        return invalid_change_batch("DS value is malformed.")

    fields = _split_fields(value, 4)
    if not fields:
        raise fail()
    keytag = _int_in_range(fields[0], 0, U16_MAX)
    algorithm = _int_in_range(fields[1], 0, 255)
    digesttype = _int_in_range(fields[2], 0, 255)
    if keytag is None or algorithm is None or digesttype is None:
        raise fail()
    digest = fields[3]
    if len(digest) < 4 or len(digest) % 2 != 0 or not HEX_RE.fullmatch(digest):
        raise fail()
    return f"{keytag} {algorithm} {digesttype} {digest.lower()}"


def _validate_cname(value: str) -> str:
    return _hostname(value)


REGISTRY: Final[dict[str, ValueValidator]] = {
    "A": _validate_a,
    "AAAA": _validate_aaaa,
    "CNAME": _validate_cname,
    "TXT": _validate_txt,
    "SPF": _validate_txt,
    "MX": _validate_mx,
    "NS": _validate_cname,
    "PTR": _validate_cname,
    "SRV": _validate_srv,
    "CAA": _validate_caa,
    "SOA": _validate_soa,
    "NAPTR": _validate_naptr,
    "DS": _validate_ds,
}


def validate_value(record_type: str, value: str) -> str:
    """Validate and normalise one rdata value for a record type."""
    validator = REGISTRY.get(record_type)
    if validator is None:
        raise invalid_change_batch(f"Record type {record_type} is not supported.")
    return validator(value)


def validate_values(record_type: str, values: list[str]) -> list[str]:
    """Validate a full value list for a record set: non-empty, CNAME sets
    carry exactly one value, every value passes its type's validator."""
    if not values:
        raise invalid_change_batch("At least one value is required for non-alias records.")
    if record_type == "CNAME" and len(values) != 1:
        raise invalid_change_batch("CNAME record sets must contain exactly one value.")
    return [validate_value(record_type, value) for value in values]
