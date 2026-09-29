"""Canonical release checks against the live Studionet deployment.

Every test is read-only: the suite never sends a transaction. Funded flows are
rehearsed manually in docs/LIVE_DEMO.md. Set RIVET_CONTRACT to the deployed
address; without it the suite skips cleanly.
"""
import json
import os
from pathlib import Path

import pytest
from gltest import get_gl_client
from gltest.contracts.contract import Contract
from gltest.types import TransactionHashVariant

pytestmark = pytest.mark.skipif(not os.environ.get("RIVET_CONTRACT"), reason="RIVET_CONTRACT required")

REQUIRED_VIEWS = [
    "get_stats",
    "get_mission",
    "get_submission",
    "get_challenge",
    "get_certificate",
    "get_submission_for_commitment",
    "find_latest_mission_by_sponsor",
    "get_credit",
    "list_missions",
    "list_submissions",
    "list_certificates",
    "compute_submission_commitment",
]


def canonical():
    client = get_gl_client()
    assert client.chain_id == 61999
    address = os.environ["RIVET_CONTRACT"]
    schema = client.provider.make_request("gen_getContractSchema", [address])["result"]
    return client, Contract.new(address=address, schema=schema)


def test_canonical_studionet_contract_is_readable():
    _, contract = canonical()
    stats = contract.get_stats().call(transaction_hash_variant=TransactionHashVariant.LATEST_FINAL)
    assert stats["chain_id"] == "61999"
    assert stats["rpc"] == "https://studio.genlayer.com/api"
    assert stats["admin_controls"] is False
    assert stats["accounting_balanced"] is True
    assert stats["adjudication"] == "ARTIFACT_EXAMINATION_PLUS_CRITERION_REPAIR_REVIEW_PLUS_BONDED_CHALLENGE"


def test_deployed_source_matches_repository():
    client, _ = canonical()
    import base64
    code = base64.b64decode(client.provider.make_request("gen_getContractCode", [os.environ["RIVET_CONTRACT"]])["result"]).decode()
    # Deployments uploaded from Windows store CRLF bytes; compare content, not raw bytes.
    assert code.replace("\r\n", "\n") == Path("contracts/rivet.py").read_text().replace("\r\n", "\n")


def test_deployed_schema_exposes_every_public_view():
    client, _ = canonical()
    schema = client.provider.make_request("gen_getContractSchema", [os.environ["RIVET_CONTRACT"]])["result"]
    methods = json.dumps(schema)
    for name in REQUIRED_VIEWS:
        assert name in methods, f"missing view {name}"


def test_market_views_respond_with_expected_shapes():
    _, contract = canonical()
    missions = contract.list_missions(0, 4).call(transaction_hash_variant=TransactionHashVariant.LATEST_FINAL)
    assert "items" in missions and "total" in missions
    certificates = contract.list_certificates(0, 4).call(transaction_hash_variant=TransactionHashVariant.LATEST_FINAL)
    assert "items" in certificates and "total" in certificates


def test_credit_view_returns_atto_string():
    _, contract = canonical()
    zero_address = "0x00000000000000000000000000000000000000dEaD"
    credit = contract.get_credit(zero_address).call(transaction_hash_variant=TransactionHashVariant.LATEST_FINAL)
    assert int(credit) >= 0


def test_accounting_breakdown_sums_to_deposits():
    _, contract = canonical()
    stats = contract.get_stats().call(transaction_hash_variant=TransactionHashVariant.LATEST_FINAL)
    deposited = int(stats["total_deposited_atto"])
    parts = (
        int(stats["reward_escrow_atto"])
        + int(stats["submission_escrow_atto"])
        + int(stats["challenge_escrow_atto"])
        + int(stats["claimable_atto"])
        + int(stats["withdrawn_atto"])
    )
    assert deposited == parts
