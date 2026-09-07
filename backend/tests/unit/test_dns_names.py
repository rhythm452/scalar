"""Name normalisation (docs/ROUTE53-DOMAIN-RULES.md R5, app/core/dns_names.py):
idempotency, wildcards, IDN, and zone-membership checks.
"""

from __future__ import annotations

import pytest

from app.core.dns_names import (
    InvalidName,
    is_within_zone,
    normalise,
    normalise_hostname,
    normalise_zone_name,
)

ZONE = "example.com."


# ------------------------------------------------------------------ idempotency


@pytest.mark.parametrize(
    "value",
    [
        "example.com",
        "WWW.Example.COM.",
        "*.example.com",
        "already.normal.example.com.",
    ],
)
def test_normalise_is_idempotent(value: str) -> None:
    once = normalise(value)
    twice = normalise(once)
    assert once == twice


@pytest.mark.parametrize("value", ["www", "@", "_sip._tcp"])
def test_normalise_with_zone_is_idempotent(value: str) -> None:
    once = normalise(value, zone=ZONE)
    twice = normalise(once, zone=ZONE)
    assert once == twice


# ---------------------------------------------------------------------- @ apex


def test_bare_at_maps_to_zone_apex() -> None:
    assert normalise("@", zone=ZONE) == ZONE


def test_bare_at_without_zone_is_invalid() -> None:
    with pytest.raises(InvalidName):
        normalise("@")


# --------------------------------------------------------------------- relative


def test_relative_name_gets_zone_suffix() -> None:
    assert normalise("www", zone=ZONE) == "www.example.com."


def test_relative_multi_label_name_gets_zone_suffix() -> None:
    assert normalise("_sip._tcp", zone=ZONE) == "_sip._tcp.example.com."


def test_absolute_name_is_left_alone() -> None:
    assert normalise("other.org.", zone=ZONE) == "other.org."


# --------------------------------------------------------------------- wildcard


def test_wildcard_label_is_legal() -> None:
    assert normalise("*.example.com") == "*.example.com."


def test_wildcard_with_zone() -> None:
    assert normalise("*", zone=ZONE) == "*.example.com."


# -------------------------------------------------------------------------- IDN


def test_idn_label_encodes_to_punycode() -> None:
    expected_label = "café".encode("idna").decode("ascii")
    assert normalise("café.example.com") == f"{expected_label}.example.com."


def test_idn_result_round_trips_idempotently() -> None:
    once = normalise("café.example.com")
    assert normalise(once) == once


# ------------------------------------------------------------------- rejections


@pytest.mark.parametrize(
    "value",
    [
        "",
        "..double-dot.example.com",
        "-leading-hyphen.example.com",
        "trailing-hyphen-.example.com",
        "a" * 64 + ".example.com",  # label over 63 chars
    ],
)
def test_invalid_names_rejected(value: str) -> None:
    with pytest.raises(InvalidName):
        normalise(value)


def test_name_over_253_chars_rejected() -> None:
    long_name = ".".join(["a" * 50] * 5) + ".com"  # far over the 253-char limit
    with pytest.raises(InvalidName):
        normalise(long_name)


# --------------------------------------------------------------- zone normalisation


def test_zone_name_normalises_like_a_record_name() -> None:
    assert normalise_zone_name("Example.COM") == "example.com."


def test_single_label_zone_name_rejected() -> None:
    with pytest.raises(InvalidName):
        normalise_zone_name("localhost")


# ------------------------------------------------------------------- zone membership


def test_apex_is_within_its_own_zone() -> None:
    assert is_within_zone(ZONE, ZONE) is True


def test_subdomain_is_within_zone() -> None:
    assert is_within_zone("www.example.com.", ZONE) is True


def test_sibling_domain_is_not_within_zone() -> None:
    assert is_within_zone("other.com.", ZONE) is False


def test_suffix_collision_is_not_within_zone() -> None:
    # "notexample.com." shares the suffix "example.com." as a *substring*
    # but not as a DNS label boundary, so it must not be treated as inside.
    assert is_within_zone("notexample.com.", ZONE) is False


# ---------------------------------------------------------------- normalise_hostname


def test_normalise_hostname_lowercases_and_qualifies() -> None:
    assert normalise_hostname("Host.Example.COM") == "host.example.com."


def test_normalise_hostname_accepts_trailing_dot() -> None:
    assert normalise_hostname("host.example.com.") == "host.example.com."


def test_normalise_hostname_rejects_underscore() -> None:
    # Owner names allow underscores (R5); rdata hostnames do not -- they
    # name a host, not a DNS label, per app/core/dns_names.py.
    with pytest.raises(InvalidName):
        normalise_hostname("_sip.example.com.")


def test_normalise_hostname_allows_wildcard_label() -> None:
    assert normalise_hostname("*.example.com.") == "*.example.com."
