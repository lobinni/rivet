import json
import pytest

from tests.direct.conftest import (
    BASE, CANDIDATE, NOW, NOW_UNIX, REWARD, SALT,
    addr_hex, criteria_json, evidence_json,
    mock_challenge_inconclusive, mock_challenge_rejected, mock_challenge_upheld,
    mock_inconclusive_review, mock_not_ready_artifact, mock_qualified_review,
    mock_rejected_review, mock_source_unavailable, mock_verified_artifact,
    open_mission,
)

CONTRACT = "contracts/rivet.py"
LATER = "2026-09-19T12:31:00Z"
WINDOW_DONE = "2026-09-19T12:46:00Z"


def setup_submission(vm, contract, sponsor, contributor):
    mid = open_mission(contract, vm, sponsor)
    vm.sender = contributor
    contributor_hex = addr_hex(contributor)
    commitment = contract.compute_submission_commitment(mid, contributor_hex, CANDIDATE, evidence_json(), SALT)
    mission = contract.get_mission(mid)
    vm.value = int(mission["submission_bond_atto"])
    sid = contract.commit_candidate(mid, commitment)
    vm.value = 0
    contract.reveal_candidate(sid, CANDIDATE, evidence_json(), SALT)
    return mid, sid


def qualified_submission(vm, contract, sponsor, contributor):
    mid, sid = setup_submission(vm, contract, sponsor, contributor)
    mock_verified_artifact(vm)
    contract.examine_candidate(sid)
    mock_qualified_review(vm)
    contract.review_candidate(sid)
    return mid, sid


def test_open_mission_freezes_spec_and_accounts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    mission = contract.get_mission(mid)
    assert mission["status"] == "OPEN"
    assert mission["sponsor"].lower() == addr_hex(direct_alice).lower()
    assert int(mission["reward_atto"]) == REWARD
    assert int(mission["submission_bond_atto"]) == REWARD // 100
    assert int(mission["challenge_bond_atto"]) == max(2 * 10**14, REWARD // 50)
    assert len(mission["spec_hash"]) == 64
    stats = contract.get_stats()
    assert stats["accounting_balanced"] is True
    assert int(stats["reward_escrow_atto"]) == REWARD


def test_happy_path_certificate_and_pull_payment(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid, sid = qualified_submission(direct_vm, contract, direct_alice, direct_bob)
    submission = contract.get_submission(sid)
    assert submission["status"] == "QUALIFIED_PENDING"
    mission = contract.get_mission(mid)
    assert mission["status"] == "QUALIFIED_PENDING"
    direct_vm.warp(WINDOW_DONE)
    certificate_hash = contract.finalize_submission(sid)
    mission = contract.get_mission(mid)
    assert mission["status"] == "CLOSED"
    assert mission["certificate_hash"] == certificate_hash
    assert mission["winner"].lower() == addr_hex(direct_bob).lower()
    certificate = contract.get_certificate(mid)
    assert [row["result"] for row in certificate["criteria"]] == ["SATISFIED"] * 3
    expected_credit = REWARD + REWARD // 100
    assert int(contract.get_credit(addr_hex(direct_bob))) == expected_credit
    direct_vm.sender = direct_bob
    contract.withdraw_credit(addr_hex(direct_bob))
    assert int(contract.get_credit(addr_hex(direct_bob))) == 0
    stats = contract.get_stats()
    assert stats["accounting_balanced"] is True
    assert int(stats["finalized_repairs"]) == 1
    assert int(stats["withdrawn_atto"]) == expected_credit


def test_rejected_review_sends_bond_to_sponsor(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid, sid = setup_submission(direct_vm, contract, direct_alice, direct_bob)
    mock_verified_artifact(direct_vm)
    contract.examine_candidate(sid)
    mock_rejected_review(direct_vm)
    status = contract.review_candidate(sid)
    assert status == "REJECTED"
    assert int(contract.get_credit(addr_hex(direct_alice))) == REWARD // 100
    assert contract.get_stats()["accounting_balanced"] is True


def test_inconclusive_review_refunds_contributor(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid, sid = setup_submission(direct_vm, contract, direct_alice, direct_bob)
    mock_verified_artifact(direct_vm)
    contract.examine_candidate(sid)
    mock_inconclusive_review(direct_vm)
    status = contract.review_candidate(sid)
    assert status == "INCONCLUSIVE"
    assert int(contract.get_credit(addr_hex(direct_bob))) == REWARD // 100
    assert contract.get_stats()["accounting_balanced"] is True


def test_not_ready_artifact_refunds_and_frees_candidate(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid, sid = setup_submission(direct_vm, contract, direct_alice, direct_bob)
    mock_not_ready_artifact(direct_vm)
    status = contract.examine_candidate(sid)
    assert status == "NOT_READY"
    assert int(contract.get_credit(addr_hex(direct_bob))) == REWARD // 100
    # The reservation is released: the same candidate SHA may re-enter later.
    assert contract.get_mission(mid)["active_submissions"] == 0


def test_source_unavailable_is_a_non_decision(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid, sid = setup_submission(direct_vm, contract, direct_alice, direct_bob)
    mock_source_unavailable(direct_vm)
    status = contract.examine_candidate(sid)
    assert status == "SOURCE_UNAVAILABLE"
    assert int(contract.get_credit(addr_hex(direct_bob))) == REWARD // 100
    assert contract.get_stats()["accounting_balanced"] is True


def test_rejected_challenge_bond_becomes_winner_bonus(direct_vm, direct_deploy, direct_alice, direct_bob, direct_carol):
    contract = direct_deploy(CONTRACT)
    mid, sid = qualified_submission(direct_vm, contract, direct_alice, direct_bob)
    mission = contract.get_mission(mid)
    challenge_bond = int(mission["challenge_bond_atto"])
    direct_vm.sender = direct_carol
    direct_vm.value = challenge_bond
    cid = contract.open_challenge(sid, "C2", "https://example.com/regression-log", "Claimed CRLF regression on a fresh CI run for the exact candidate SHA.")
    direct_vm.value = 0
    mock_challenge_rejected(direct_vm)
    outcome = contract.resolve_challenge(cid)
    assert outcome == "REJECTED"
    mission = contract.get_mission(mid)
    assert int(mission["bonus_atto"]) == challenge_bond
    direct_vm.warp(WINDOW_DONE)
    contract.finalize_submission(sid)
    expected = REWARD + challenge_bond + REWARD // 100
    assert int(contract.get_credit(addr_hex(direct_bob))) == expected
    assert contract.get_stats()["accounting_balanced"] is True


def test_upheld_challenge_splits_candidate_bond(direct_vm, direct_deploy, direct_alice, direct_bob, direct_carol):
    contract = direct_deploy(CONTRACT)
    mid, sid = qualified_submission(direct_vm, contract, direct_alice, direct_bob)
    mission = contract.get_mission(mid)
    challenge_bond = int(mission["challenge_bond_atto"])
    submission_bond = int(mission["submission_bond_atto"])
    direct_vm.sender = direct_carol
    direct_vm.value = challenge_bond
    cid = contract.open_challenge(sid, "C2", "https://example.com/regression-log", "Claimed CRLF regression on a fresh CI run for the exact candidate SHA.")
    direct_vm.value = 0
    mock_challenge_upheld(direct_vm)
    outcome = contract.resolve_challenge(cid)
    assert outcome == "UPHELD"
    assert int(contract.get_credit(addr_hex(direct_carol))) == challenge_bond + submission_bond // 2
    assert int(contract.get_credit(addr_hex(direct_alice))) == submission_bond - submission_bond // 2
    # Mission reopens for new candidates.
    assert contract.get_mission(mid)["status"] == "OPEN"
    assert contract.get_stats()["accounting_balanced"] is True


def test_inconclusive_challenge_refunds_bond(direct_vm, direct_deploy, direct_alice, direct_bob, direct_carol):
    contract = direct_deploy(CONTRACT)
    mid, sid = qualified_submission(direct_vm, contract, direct_alice, direct_bob)
    mission = contract.get_mission(mid)
    challenge_bond = int(mission["challenge_bond_atto"])
    direct_vm.sender = direct_carol
    direct_vm.value = challenge_bond
    cid = contract.open_challenge(sid, "C2", "https://example.com/regression-log", "Claimed CRLF regression on a fresh CI run for the exact candidate SHA.")
    direct_vm.value = 0
    mock_challenge_inconclusive(direct_vm)
    outcome = contract.resolve_challenge(cid)
    assert outcome == "INCONCLUSIVE"
    assert int(contract.get_credit(addr_hex(direct_carol))) == challenge_bond
    assert contract.get_stats()["accounting_balanced"] is True


def test_sponsor_cannot_compete(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_alice
    commitment = contract.compute_submission_commitment(mid, addr_hex(direct_alice), CANDIDATE, evidence_json(), SALT)
    direct_vm.value = int(contract.get_mission(mid)["submission_bond_atto"])
    with pytest.raises(Exception):
        contract.commit_candidate(mid, commitment)
    direct_vm.value = 0


def test_reveal_must_match_commitment(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    commitment = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), SALT)
    direct_vm.value = int(contract.get_mission(mid)["submission_bond_atto"])
    sid = contract.commit_candidate(mid, commitment)
    direct_vm.value = 0
    with pytest.raises(Exception):
        contract.reveal_candidate(sid, BASE, evidence_json(), "22" * 32)


def test_commitments_are_single_use(direct_vm, direct_deploy, direct_alice, direct_bob, direct_carol):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    commitment = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), SALT)
    bond = int(contract.get_mission(mid)["submission_bond_atto"])
    direct_vm.value = bond
    contract.commit_candidate(mid, commitment)
    direct_vm.sender = direct_carol
    with pytest.raises(Exception):
        contract.commit_candidate(mid, commitment)
    direct_vm.value = 0


def test_reveal_timeout_loses_bond_to_sponsor(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    commitment = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), SALT)
    direct_vm.value = int(contract.get_mission(mid)["submission_bond_atto"])
    sid = contract.commit_candidate(mid, commitment)
    direct_vm.value = 0
    with pytest.raises(Exception):
        contract.reveal_candidate(sid, CANDIDATE, evidence_json(), SALT) if False else None
    direct_vm.warp(LATER)
    with pytest.raises(Exception):
        contract.reveal_candidate(sid, CANDIDATE, evidence_json(), SALT)
    contract.expire_submission(sid)
    assert contract.get_submission(sid)["status"] == "UNREVEALED"
    assert int(contract.get_credit(addr_hex(direct_alice))) == REWARD // 100
    assert contract.get_stats()["accounting_balanced"] is True


def test_expired_mission_refunds_sponsor(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    direct_vm.warp("2026-09-20T13:00:00Z")
    contract.expire_mission(mid)
    assert contract.get_mission(mid)["status"] == "EXPIRED"
    assert int(contract.get_credit(addr_hex(direct_alice))) == REWARD
    assert contract.get_stats()["accounting_balanced"] is True


def test_cancel_only_when_untouched(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with pytest.raises(Exception):
        contract.cancel_mission(mid)
    direct_vm.sender = direct_alice
    contract.cancel_mission(mid)
    assert contract.get_mission(mid)["status"] == "CANCELLED"
    assert int(contract.get_credit(addr_hex(direct_alice))) == REWARD
    assert contract.get_stats()["accounting_balanced"] is True


def test_withdraw_only_by_recipient_and_only_once(direct_vm, direct_deploy, direct_alice, direct_bob, direct_carol):
    contract = direct_deploy(CONTRACT)
    mid, sid = qualified_submission(direct_vm, contract, direct_alice, direct_bob)
    direct_vm.warp(WINDOW_DONE)
    contract.finalize_submission(sid)
    direct_vm.sender = direct_carol
    with pytest.raises(Exception):
        contract.withdraw_credit(addr_hex(direct_bob))
    direct_vm.sender = direct_bob
    contract.withdraw_credit(addr_hex(direct_bob))
    with pytest.raises(Exception):
        contract.withdraw_credit(addr_hex(direct_bob))
    assert contract.get_stats()["accounting_balanced"] is True
