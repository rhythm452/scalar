"""Per-type rdata validators (docs/ROUTE53-DOMAIN-RULES.md R7,
app/core/rdata.py): one valid case and at least three invalid cases per
type, asserting the exact error message. Covers all 13 record types the
schema supports -- a superset of R7's headline ten.
"""

from __future__ import annotations

import pytest

from app.core.errors import Route53Error
from app.core.rdata import validate_value, validate_values


def _message(record_type: str, value: str) -> str:
    with pytest.raises(Route53Error) as excinfo:
        validate_value(record_type, value)
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    return excinfo.value.message


# ------------------------------------------------------------------------ A


def test_a_valid() -> None:
    assert validate_value("A", "192.0.2.1") == "192.0.2.1"


@pytest.mark.parametrize("value", ["not-an-ip", "256.1.1.1", "192.168.1"])
def test_a_invalid(value: str) -> None:
    assert _message("A", value) == f"Value {value} is not a valid IPv4 address."


# --------------------------------------------------------------------- AAAA


def test_aaaa_valid() -> None:
    assert validate_value("AAAA", "2001:DB8::1") == "2001:db8::1"


@pytest.mark.parametrize("value", ["not-ipv6", "192.0.2.1", "gggg::1"])
def test_aaaa_invalid(value: str) -> None:
    assert _message("AAAA", value) == f"Value {value} is not a valid IPv6 address."


# -------------------------------------------------------------------- CNAME


def test_cname_valid() -> None:
    assert validate_value("CNAME", "target.example.com") == "target.example.com."


@pytest.mark.parametrize("value", ["", "bad_host.example.com", "-leading-hyphen.example.com"])
def test_cname_invalid(value: str) -> None:
    assert _message("CNAME", value) == f"Value {value} is not a valid hostname."


# ------------------------------------------------------------------ NS, PTR


@pytest.mark.parametrize("record_type", ["NS", "PTR"])
def test_ns_ptr_valid(record_type: str) -> None:
    assert validate_value(record_type, "ns1.example.com") == "ns1.example.com."


@pytest.mark.parametrize("record_type", ["NS", "PTR"])
@pytest.mark.parametrize("value", ["", "under_score.example.com", "trailing-.example.com"])
def test_ns_ptr_invalid(record_type: str, value: str) -> None:
    assert _message(record_type, value) == f"Value {value} is not a valid hostname."


# -------------------------------------------------------------------- TXT, SPF

TXT_FAIL = "TXT strings must be quoted with max 255 characters per string."


@pytest.mark.parametrize("record_type", ["TXT", "SPF"])
def test_txt_spf_valid(record_type: str) -> None:
    assert validate_value(record_type, '"hello world"') == '"hello world"'


@pytest.mark.parametrize("record_type", ["TXT", "SPF"])
@pytest.mark.parametrize("value", ["hello", '"unterminated', '"' + "x" * 256 + '"'])
def test_txt_spf_invalid(record_type: str, value: str) -> None:
    assert _message(record_type, value) == TXT_FAIL


# ------------------------------------------------------------------------ MX


def test_mx_valid() -> None:
    assert validate_value("MX", "10 mail.example.com") == "10 mail.example.com."


@pytest.mark.parametrize("value", ["mail.example.com", "70000 mail.example.com", "10 bad_host!"])
def test_mx_invalid(value: str) -> None:
    assert _message("MX", value) == 'MX value must be in the format "<priority> <hostname>".'


# ----------------------------------------------------------------------- SRV


def test_srv_valid() -> None:
    assert validate_value("SRV", "10 60 5060 sip.example.com") == "10 60 5060 sip.example.com."


@pytest.mark.parametrize(
    "value", ["10 60 5060", "70000 60 5060 sip.example.com", "10 60 5060 bad_host!"]
)
def test_srv_invalid(value: str) -> None:
    assert (
        _message("SRV", value)
        == 'SRV value must be in the format "<priority> <weight> <port> <target>".'
    )


# ----------------------------------------------------------------------- CAA


def test_caa_valid() -> None:
    assert validate_value("CAA", '0 issue "letsencrypt.org"') == '0 issue "letsencrypt.org"'


@pytest.mark.parametrize("value", ['256 issue "x"', '0 badtag "x"', "0 issue"])
def test_caa_invalid(value: str) -> None:
    assert _message("CAA", value) == 'CAA value must be in the format "<flags> <tag> <value>".'


# ----------------------------------------------------------------------- SOA


def test_soa_valid() -> None:
    value = "ns1.example.com admin.example.com 1 7200 900 1209600 86400"
    assert (
        validate_value("SOA", value)
        == "ns1.example.com. admin.example.com. 1 7200 900 1209600 86400"
    )


@pytest.mark.parametrize(
    "value",
    [
        "ns1.example.com admin.example.com 1 2 3",
        "bad_host! admin.example.com 1 2 3 4 5",
        "ns1.example.com admin.example.com 1 2 3 4 99999999999",
    ],
)
def test_soa_invalid(value: str) -> None:
    assert _message("SOA", value) == (
        "SOA value must be in the format "
        '"<mname> <rname> <serial> <refresh> <retry> <expire> <minimum>".'
    )


# --------------------------------------------------------------------- NAPTR


def test_naptr_valid() -> None:
    value = '100 10 "S" "SIP+D2U" "!^.*$!sip:info@example.com!" _sip._tcp.example.com.'
    assert validate_value("NAPTR", value) == value


@pytest.mark.parametrize(
    "value",
    [
        "100 10 S SIP+D2U",
        'notanumber 10 "S" "SIP+D2U" "regexp" example.com.',
        '100 10 "S" "SIP+D2U" "regexp" bad_host!',
    ],
)
def test_naptr_invalid(value: str) -> None:
    assert _message("NAPTR", value) == "NAPTR value is malformed."


# ------------------------------------------------------------------------ DS


def test_ds_valid() -> None:
    assert (
        validate_value("DS", "12345 13 2 DEADBEEF1234ABCD5678901234ABCD")
        == "12345 13 2 deadbeef1234abcd5678901234abcd"
    )


@pytest.mark.parametrize(
    "value",
    [
        "12345 13 2",
        "12345 13 2 nothex",
        "12345 13 2 abc",  # odd-length hex digest
    ],
)
def test_ds_invalid(value: str) -> None:
    assert _message("DS", value) == "DS value is malformed."


# -------------------------------------------------------------- unsupported type


def test_unsupported_type_rejected() -> None:
    with pytest.raises(Route53Error) as excinfo:
        validate_value("BOGUS", "x")
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "Record type BOGUS is not supported."


# -------------------------------------------------------------- validate_values


def test_validate_values_rejects_empty_list() -> None:
    with pytest.raises(Route53Error) as excinfo:
        validate_values("A", [])
    assert excinfo.value.message == "At least one value is required for non-alias records."


def test_validate_values_rejects_multi_value_cname() -> None:
    with pytest.raises(Route53Error) as excinfo:
        validate_values("CNAME", ["a.example.com.", "b.example.com."])
    assert excinfo.value.message == "CNAME record sets must contain exactly one value."


def test_validate_values_normalises_every_value() -> None:
    assert validate_values("A", ["192.0.2.1", "192.0.2.2"]) == ["192.0.2.1", "192.0.2.2"]
