# Testing guide

Rivet ships with two suites. The **direct suite** runs the contract locally
with mocked HTTP and mocked LLM consensus so every path is deterministic. The
**integration suite** runs against the live Studionet deployment and verifies
the release that users actually hit.

> Hands-on testing with MetaMask from VSCode — read-only checks, the full web
> flow, a funded terminal roundtrip, and troubleshooting — has its own
> step-by-step document: [docs/LIVE_TESTING_VSCODE.md](LIVE_TESTING_VSCODE.md).
> Ready-made mission fixtures for manual live tests (what to paste into every
> field, per scenario, with expected outcomes) live in
> [samples/README.md](../samples/README.md).

## 1. Prerequisites

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Tools installed: `genlayer-test` (gltest runner + local GenVM harness),
`genlayer-py` (contract SDK types), `genvm-linter`, `pytest`.

## 2. Lint the contract

```bash
genvm-lint check contracts/rivet.py --json
```

Expected: no findings. The contract is also compiled by the direct suite on
every run, so syntax errors fail fast.

## 3. Direct unit suite (offline, deterministic)

```bash
pytest tests/direct/ -v
```

What it covers, by file:

**`tests/direct/test_rivet.py`**

1. Mission creation freezes the spec, derives both bonds, and updates the
   escrow accounting invariant.
2. Full happy path: commit → reveal → verified artifact → qualified review →
   challenge window survives → finalize → certificate → winner withdraws
   reward + bond via pull payment.
3. Rejected review sends the submission bond to the sponsor.
4. Inconclusive review refunds the submission bond to the contributor.
5. `NOT_READY` and `SOURCE_UNAVAILABLE` artifact results refund without
   consuming the candidate reservation.
6. Rejected challenge bond becomes winner bonus; upheld challenge refunds the
   challenger and splits the candidate bond 50/50 between challenger and
   sponsor; inconclusive challenge refunds the challenger bond.
7. Sponsor cannot compete, contributor cannot reveal late, reveal must match
   the commitment, commitments are single-use, candidate SHAs cannot
   double-enter a mission.
8. Expiry cranks: unrevealed commitments lose the bond to the sponsor;
   expired missions refund the sponsor.
9. Pull payments: credits are only withdrawable by their recipient, exactly
   once.

**`tests/direct/test_regressions.py`**

Boundary and abuse cases observed during review: bond floors at tiny rewards,
the challenge-window floor extension after a late challenge resolution,
criterion roll-up obedience (`QUALIFIED` impossible with a `NOT_PROVEN`
row), and the accounting invariant after mixed outcomes.

All external effects are stubbed through the harness:

- `vm.mock_web(pattern, response)` — replaces validator web fetches,
- `vm.mock_llm(pattern, payload)` — replaces the examiner/Judge prompts,
- `vm.warp(iso)` — moves contract time,
- `vm.sender` / `vm.value` — sets `gl.message.sender_address` / `gl.message.value`.

## 4. Integration suite (Studionet, live)

The release is live at the canonical address
[`0x610a3787effC958d3693ad9f747c3a8896540844`](https://explorer-studio.genlayer.com/address/0x610a3787effC958d3693ad9f747c3a8896540844).
A one-shot read-only proof of that is the dependency-free script:

```bash
node scripts/verify-deployment.mjs
```

For the full gltest smoke suite, point it at the canonical address:

```bash
RIVET_CONTRACT=0x610a3787effC958d3693ad9f747c3a8896540844 gltest tests/integration/ -v -s --network studionet
```

The suite asserts, against finalized state:

1. `get_stats` reports chain `61999`, the canonical RPC, `admin_controls`
   false, and a balanced accounting invariant.
2. The deployed source code equals `contracts/rivet.py` after line-ending
   normalization — the live deployment was uploaded with CRLF bytes, so
   content equality (not raw-byte equality) is the honest check.
3. The deployed schema exposes every public view the web app needs
   (via `gen_getContractSchema`).
4. Every public view required by the web app responds with the expected
   shape (`list_missions`, `list_certificates`, `get_credit`).

The suite is read-only; it never sends a transaction itself. A full funded
walkthrough that does send transactions is scripted in
[docs/LIVE_DEMO.md](LIVE_DEMO.md).

**Without `RIVET_CONTRACT` set, every integration test is skipped** — export
the canonical address above to enable it.

## 5. Web application checks

```bash
npm install
npm run build      # production build; must typecheck and bundle cleanly
npm run dev        # manual smoke at http://localhost:5173
```

Manual wallet smoke list:

1. Load the app with MetaMask installed but on the wrong network → the
   connect flow offers to switch/add Studionet (`61999`).
2. Connect → header shows the truncated address and a live network chip.
3. The live address ships in `deployments/studionet.json` → the market board,
   certificates and stats hydrate from the contract with no env setup. (If
   the record is ever cleared, views fall back to an explicit pre-deployment
   state and funded actions disable themselves.)
4. Open a mission, commit a candidate, confirm the reveal payload appears
   under Workbench, and withdraw credit after settlement.

## 6. Test matrix summary

| Layer | Tool | Network | Money moved | Determinism |
| --- | --- | --- | --- | --- |
| Contract logic | pytest + local GenVM | none | simulated | fully deterministic mock consensus |
| Release integrity | gltest | studionet | reads only | live finalized state |
| Funded flow | docs/LIVE_DEMO.md | studionet | real GEN bonds/rewards | live consensus |
| Web app | vite build + manual | studionet via MetaMask | user-signed | live |
