import json

NOW = "2026-09-19T12:00:00Z"
NOW_UNIX = 1789819200
REWARD = 10**18
REPO = "https://github.com/example/dataforge"
ISSUE = "https://github.com/example/dataforge/issues/418"
BASE = "8a95c7d1b75c8e4309d21698b5033de8c49b0c73"
CANDIDATE = "41bd7eaf9d80d44d2990a52a45784e92783e17ea"
SALT = "11" * 32


def addr_hex(value):
    if hasattr(value, "as_hex"):
        return value.as_hex
    return "0x" + bytes(value).hex()


def criteria_json():
    return json.dumps([
        {"id": "C1", "text": "Quoted CSV fields containing LF must round-trip without data loss.", "evidence_hint": "diff and regression test"},
        {"id": "C2", "text": "Quoted CSV fields containing CRLF must round-trip without data loss.", "evidence_hint": "diff and Windows test"},
        {"id": "C3", "text": "Existing public parser API signatures must remain compatible.", "evidence_hint": "diff and compatibility CI"},
    ])


def evidence_json():
    return json.dumps([
        {"kind": "COMMIT", "url": "https://github.com/example/dataforge/commit/41bd7eaf9d80d44d2990a52a45784e92783e17ea", "note": "exact candidate commit"},
        {"kind": "DIFF", "url": "https://github.com/example/dataforge/commit/41bd7eaf9d80d44d2990a52a45784e92783e17ea.diff", "note": "patch against the frozen base"},
        {"kind": "CI", "url": "https://github.com/example/dataforge/actions/runs/418", "note": "official CI for the candidate SHA"},
    ])


def open_mission(contract, vm, sponsor, reward=REWARD, closes_at=NOW_UNIX + 86400, challenge_window=900):
    vm.sender = sponsor
    vm.value = reward
    vm.warp(NOW)
    mid = contract.open_mission(
        "Repair multiline CSV parsing",
        REPO,
        ISSUE,
        BASE,
        "main",
        "CSV exports fail when a quoted field contains an embedded newline. Repair parsing without changing the public API.",
        criteria_json(),
        "Changes may touch src/csv/** and tests/csv/** only.",
        "No dependency replacement, public API removal, or unrelated refactor.",
        "Use the upstream GitHub repository, exact commit and diff pages, and official CI bound to the candidate SHA.",
        True,
        closes_at,
        challenge_window,
    )
    vm.value = 0
    return mid


def mock_verified_artifact(vm):
    vm.mock_web(r"github\.com/example/dataforge/.*", {"status": 200, "body": "candidate 41bd7ea descends from 8a95c7d; diff modifies csv parser and tests; CI completed successfully"})
    vm.mock_llm(r"RIVET_ARTIFACT_EXAMINER_V1.*", json.dumps({
        "status": "VERIFIED",
        "repository_matches": True,
        "candidate_exists": True,
        "base_relationship_supported": True,
        "commit_bound": True,
        "diff_available": True,
        "ci_completed": True,
        "ci_passed": True,
        "scope_review_possible": True,
        "basis": "Evidence bundle identifies the exact candidate commit and final CI for the frozen repository.",
    }))


def mock_not_ready_artifact(vm):
    vm.mock_web(r"github\.com/example/dataforge/.*", {"status": 200, "body": "candidate exists; CI is still running"})
    vm.mock_llm(r"RIVET_ARTIFACT_EXAMINER_V1.*", json.dumps({
        "status": "NOT_READY",
        "repository_matches": True,
        "candidate_exists": True,
        "base_relationship_supported": True,
        "commit_bound": True,
        "diff_available": True,
        "ci_completed": False,
        "ci_passed": False,
        "scope_review_possible": False,
        "basis": "Required CI for the candidate SHA has not completed.",
    }))


def mock_source_unavailable(vm):
    vm.mock_web(r"github\.com/example/dataforge/.*", {"status": 404, "body": ""})


def _review_payload(criteria_results, verdict, ci_passed=True, scope_violation=False, forbidden_change=False, basis="Judged against the frozen spec."):
    return json.dumps({
        "criteria": [{"id": cid, "result": res} for cid, res in criteria_results],
        "scope_violation": scope_violation,
        "forbidden_change": forbidden_change,
        "ci_passed": ci_passed,
        "verdict": verdict,
        "basis": basis,
    })


def mock_qualified_review(vm):
    vm.mock_llm(r"RIVET_REPAIR_JUDGE_V1.*", _review_payload(
        [("C1", "SATISFIED"), ("C2", "SATISFIED"), ("C3", "SATISFIED")], "QUALIFIED",
        basis="All criteria are supported by the fetched diff, tests and CI.",
    ))


def mock_rejected_review(vm):
    vm.mock_llm(r"RIVET_REPAIR_JUDGE_V1.*", _review_payload(
        [("C1", "SATISFIED"), ("C2", "FAILED"), ("C3", "SATISFIED")], "REJECTED",
        basis="CRLF handling regresses in the fetched evidence.",
    ))


def mock_inconclusive_review(vm):
    vm.mock_llm(r"RIVET_REPAIR_JUDGE_V1.*", _review_payload(
        [("C1", "SATISFIED"), ("C2", "NOT_PROVEN"), ("C3", "SATISFIED")], "INCONCLUSIVE",
        basis="CRLF coverage is not provable from the fetched bundle.",
    ))


def mock_challenge_rejected(vm):
    vm.mock_web(r"example\.com/regression.*", {"status": 200, "body": "infra flake unrelated to the candidate"})
    vm.mock_llm(r"RIVET_CHALLENGE_JUDGE_V1.*", json.dumps({
        "outcome": "REJECTED",
        "evidence_valid": True,
        "criterion_still_satisfied": True,
        "scope_violation_found": False,
        "ci_regression_found": False,
        "basis": "Challenge evidence does not defeat the frozen criterion.",
    }))


def mock_challenge_upheld(vm):
    vm.mock_web(r"example\.com/regression.*", {"status": 200, "body": "fresh CI run on the candidate SHA shows CRLF failure"})
    vm.mock_llm(r"RIVET_CHALLENGE_JUDGE_V1.*", json.dumps({
        "outcome": "UPHELD",
        "evidence_valid": True,
        "criterion_still_satisfied": False,
        "scope_violation_found": False,
        "ci_regression_found": True,
        "basis": "New exact-SHA CI evidence defeats criterion C2.",
    }))


def mock_challenge_inconclusive(vm):
    vm.mock_web(r"example\.com/regression.*", {"status": 200, "body": "partial log, truncated"})
    vm.mock_llm(r"RIVET_CHALLENGE_JUDGE_V1.*", json.dumps({
        "outcome": "INCONCLUSIVE",
        "evidence_valid": False,
        "criterion_still_satisfied": True,
        "scope_violation_found": False,
        "ci_regression_found": False,
        "basis": "Challenge material is insufficient to decide.",
    }))
