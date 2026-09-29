import json
import pytest

from tests.direct.conftest import (
    CANDIDATE, NOW_UNIX, SALT,
    addr_hex, evidence_json,
    mock_challenge_rejected, mock_qualified_review, mock_verified_artifact,
    open_mission,
)

CONTRACT = "contracts/rivet.py"
LATE_RESOLUTION = "2026-09-19T12:14:00Z"
WINDOW_DONE = "2026-09-19T12:46:00Z"


def test_bond_floors_at_tiny_reward(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    tiny = 10**15
    mid = open_mission(contract, direct_vm, direct_alice, reward=tiny)
    mission = contract.get_mission(mid)
    assert int(mission["submission_bond_atto"]) == max(10**14, tiny // 100)
    assert int(mission["challenge_bond_atto"]) == max(2 * 10**14, tiny // 50)
    assert contract.get_stats()["accounting_balanced"] is True


def test_reward_bounds_enforced(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    with pytest.raises(Exception):
        open_mission(contract, direct_vm, direct_alice, reward=10**14)
    with pytest.raises(Exception):
        open_mission(contract, direct_vm, direct_alice, reward=21 * 10**18)


def test_mission_window_bounds_enforced(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    with pytest.raises(Exception):
        open_mission(contract, direct_vm, direct_alice, closes_at=NOW_UNIX + 1800)
    with pytest.raises(Exception):
        open_mission(contract, direct_vm, direct_alice, closes_at=NOW_UNIX + 91 * 86400)
    with pytest.raises(Exception):
        open_mission(contract, direct_vm, direct_alice, challenge_window=600)
    with pytest.raises(Exception):
        open_mission(contract, direct_vm, direct_alice, challenge_window=25 * 3600)


def test_criteria_validation(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 10**18
    direct_vm.warp("2026-09-19T12:00:00Z")
    duplicated = json.dumps([
        {"id": "C1", "text": "First requirement is long enough to pass"},
        {"id": "C1", "text": "Second requirement is long enough to pass"},
    ])
    with pytest.raises(Exception):
        contract.open_mission(
            "Duplicate criterion ids", "https://github.com/example/dataforge",
            "https://github.com/example/dataforge/issues/418",
            "8a95c7d1b75c8e4309d21698b5033de8c49b0c73", "main",
            "Problem statement that is clearly long enough to be accepted.",
            duplicated, "Scope policy text", "No forbidden changes allowed.",
            "Evidence policy text", False, NOW_UNIX + 86400, 900,
        )
    direct_vm.value = 0


def test_evidence_requires_commit_and_diff(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    bad = json.dumps([
        {"kind": "TEST", "url": "https://example.com/test", "note": "only a test"},
        {"kind": "DOC", "url": "https://example.com/doc", "note": "only a doc"},
    ])
    with pytest.raises(Exception):
        contract.compute_submission_commitment(mid, addr_hex(direct_alice), CANDIDATE, bad, SALT)


def test_qualified_impossible_with_unproven_criterion(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A judge answer of QUALIFIED with a NOT_PROVEN row must be refused by normalization."""
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    commitment = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), SALT)
    direct_vm.value = int(contract.get_mission(mid)["submission_bond_atto"])
    sid = contract.commit_candidate(mid, commitment)
    direct_vm.value = 0
    contract.reveal_candidate(sid, CANDIDATE, evidence_json(), SALT)
    mock_verified_artifact(direct_vm)
    contract.examine_candidate(sid)
    direct_vm.mock_llm(r"RIVET_REPAIR_JUDGE_V1.*", json.dumps({
        "criteria": [
            {"id": "C1", "result": "SATISFIED"},
            {"id": "C2", "result": "NOT_PROVEN"},
            {"id": "C3", "result": "SATISFIED"},
        ],
        "scope_violation": False,
        "forbidden_change": False,
        "ci_passed": True,
        "verdict": "QUALIFIED",
        "basis": "Inconsistent on purpose.",
    }))
    with pytest.raises(Exception):
        contract.review_candidate(sid)


def test_late_challenge_resolution_extends_window(direct_vm, direct_deploy, direct_alice, direct_bob, direct_carol):
    """A challenge resolved near the deadline must leave at least five minutes."""
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice, challenge_window=900)
    direct_vm.sender = direct_bob
    commitment = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), SALT)
    direct_vm.value = int(contract.get_mission(mid)["submission_bond_atto"])
    sid = contract.commit_candidate(mid, commitment)
    direct_vm.value = 0
    contract.reveal_candidate(sid, CANDIDATE, evidence_json(), SALT)
    mock_verified_artifact(direct_vm)
    contract.examine_candidate(sid)
    mock_qualified_review(direct_vm)
    contract.review_candidate(sid)
    direct_vm.warp(LATE_RESOLUTION)
    mission = contract.get_mission(mid)
    direct_vm.sender = direct_carol
    direct_vm.value = int(mission["challenge_bond_atto"])
    cid = contract.open_challenge(sid, "C2", "https://example.com/regression-log", "Claimed CRLF regression on a fresh CI run for the exact candidate SHA.")
    direct_vm.value = 0
    mock_challenge_rejected(direct_vm)
    contract.resolve_challenge(cid)
    deadline = int(contract.get_submission(sid)["challenge_deadline"])
    resolved = 1789818840  # 2026-09-19T12:14:00Z
    assert deadline >= resolved + 300


def test_second_candidate_after_non_decision(direct_vm, direct_deploy, direct_alice, direct_bob):
    """NOT_READY frees the candidate SHA so a retry commitment can reuse it."""
    from tests.direct.conftest import mock_not_ready_artifact
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    bond = int(contract.get_mission(mid)["submission_bond_atto"])
    direct_vm.sender = direct_bob
    first = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), SALT)
    direct_vm.value = bond
    sid = contract.commit_candidate(mid, first)
    contract.reveal_candidate(sid, CANDIDATE, evidence_json(), SALT)
    direct_vm.value = 0
    mock_not_ready_artifact(direct_vm)
    contract.examine_candidate(sid)
    # Retry with a fresh salt commitment for the same candidate SHA.
    retry = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), "33" * 32)
    direct_vm.value = bond
    sid2 = contract.commit_candidate(mid, retry)
    contract.reveal_candidate(sid2, CANDIDATE, evidence_json(), "33" * 32)
    direct_vm.value = 0
    assert contract.get_submission(sid2)["status"] == "REVEALED"


def test_accounting_survives_mixed_outcomes(direct_vm, direct_deploy, direct_alice, direct_bob, direct_carol):
    """Deposit, refund, bonus and withdrawal flows leave the invariant intact."""
    from tests.direct.conftest import mock_inconclusive_review
    contract = direct_deploy(CONTRACT)
    mid = open_mission(contract, direct_vm, direct_alice)
    bond = int(contract.get_mission(mid)["submission_bond_atto"])
    direct_vm.sender = direct_bob
    commit_b = contract.compute_submission_commitment(mid, addr_hex(direct_bob), CANDIDATE, evidence_json(), SALT)
    direct_vm.value = bond
    sid_b = contract.commit_candidate(mid, commit_b)
    contract.reveal_candidate(sid_b, CANDIDATE, evidence_json(), SALT)
    direct_vm.value = 0
    mock_verified_artifact(direct_vm)
    contract.examine_candidate(sid_b)
    mock_inconclusive_review(direct_vm)
    contract.review_candidate(sid_b)
    other = "55eaf9d80d44d2990a52a45784e92783e17ea41bd7"
    direct_vm.sender = direct_carol
    commit_c = contract.compute_submission_commitment(mid, addr_hex(direct_carol), other, evidence_json().replace(CANDIDATE, other), "44" * 32)
    direct_vm.value = bond
    sid_c = contract.commit_candidate(mid, commit_c)
    contract.reveal_candidate(sid_c, other, evidence_json().replace(CANDIDATE, other), "44" * 32)
    direct_vm.value = 0
    mock_verified_artifact(direct_vm)
    contract.examine_candidate(sid_c)
    mock_qualified_review(direct_vm)
    contract.review_candidate(sid_c)
    direct_vm.warp(WINDOW_DONE)
    contract.finalize_submission(sid_c)
    direct_vm.sender = direct_carol
    contract.withdraw_credit(addr_hex(direct_carol))
    direct_vm.sender = direct_bob
    contract.withdraw_credit(addr_hex(direct_bob))
    stats = contract.get_stats()
    assert stats["accounting_balanced"] is True
    assert int(stats["reward_escrow_atto"]) == 0
    assert int(stats["claimable_atto"]) == 0
