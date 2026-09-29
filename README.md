# Rivet

**Funded public-software repair missions settled against exact patches, exact evidence, and a frozen work order.**

Rivet is a GenLayer-native repair market. A sponsor escrows native GEN against a public repository issue and freezes the acceptance criteria before contributors compete. Contributors commit and reveal exact Git commit SHAs plus public artifact evidence. GenLayer validators independently fetch that evidence twice: first to establish that the candidate is the claimed artifact, then to judge every frozen repair criterion. A qualifying patch enters a bonded challenge window. The first candidate that survives becomes a repair certificate and receives the reward.

Rivet is not a generic dispute wrapper, a GitHub merge bot, or an AI code reviewer. The semantic result directly controls escrowed value, but the LLM never chooses payout amounts.

## Canonical release network

This repository is intentionally locked to **GenLayer Studionet only**.

- Chain ID: `61999`
- GenLayer RPC: `https://studio.genlayer.com/api`
- Explorer: `https://explorer-studio.genlayer.com`
- Browser wallet: generic injected EIP-1193 `window.ethereum` (MetaMask)
- No Snaps, no WalletConnect, no embedded key, no backend signer

Do not deploy the release build to any other network.

**Canonical release (live):**

- Contract: [`0x610a3787effC958d3693ad9f747c3a8896540844`](https://explorer-studio.genlayer.com/address/0x610a3787effC958d3693ad9f747c3a8896540844) on Studionet
- Source verification: on-chain code matches `contracts/rivet.py` content and the deployed schema matches the schema compiled from this repository — both re-checkable at any time with `node scripts/verify-deployment.mjs`
- Release record: [`deployments/studionet.json`](deployments/studionet.json) (`status: "live"`)

## Why GenLayer is necessary

The contested question is deliberately narrow but semantic:

> Does this exact candidate commit, evidenced by the public repository/diff/CI bundle, satisfy every repair criterion that was frozen before contributors competed?

A sponsor should not be able to pick a favored contributor after seeing submissions. A contributor should not be able to self-certify a patch. A centralized AI service should not control settlement. Validators therefore re-fetch the public evidence and independently reproduce the substantive result.

The protocol separates three questions:

1. **Artifact examination** — is this actually the claimed repository, exact candidate SHA, diff and exact-SHA CI evidence, and is the bundle ready to assess?
2. **Criterion-level repair judgment** — for each frozen requirement, is it `SATISFIED`, `FAILED`, or `NOT_PROVEN`?
3. **Bonded challenge** — does new public regression evidence actually defeat a specific frozen criterion or qualification condition?

Only the resulting status crosses into deterministic settlement.

## State machine

```
OPEN MISSION
   │
   ├── contributor commits sealed candidate + evidence digest
   │
   ▼
COMMITTED ── reveal timeout ──► UNREVEALED / bond to sponsor
   │
   ▼
REVEALED
   │
   ▼
ARTIFACT EXAMINATION
   ├── SOURCE_UNAVAILABLE ──► bond refund, retry with new commitment
   ├── NOT_READY ───────────► bond refund, retry after CI finishes
   ├── INVALID_CANDIDATE ──► bond to sponsor
   ▼
ARTIFACT_VERIFIED
   │
   ▼
CRITERION REVIEW
   ├── REJECTED ───────────► bond to sponsor
   ├── INCONCLUSIVE ───────► bond refund
   ▼
QUALIFIED_PENDING
   │
   ├── bonded challenge
   │      ├── UPHELD ──────► candidate rejected; challenger rewarded
   │      ├── REJECTED ────► challenge bond joins winner pool
   │      └── INCONCLUSIVE / SOURCE_UNAVAILABLE ─► challenge bond refund
   │
   └── challenge window survives
          ▼
QUALIFIED_FINAL
          ▼
REPAIR CERTIFICATE + WINNER CREDIT
```

`SOURCE_UNAVAILABLE`, `NOT_READY`, and `INCONCLUSIVE` are explicit non-decisions. They never silently become rejection or qualification.

## Contract architecture

The release uses one advanced Intelligent Contract: [contracts/rivet.py](contracts/rivet.py).

The single address contains separate internal domains:

- immutable mission specification and spec hash;
- native GEN reward escrow;
- commit/reveal candidate binding;
- candidate SHA reservation and replay protection;
- artifact-examination consensus;
- criterion-level repair consensus;
- bonded criterion challenge consensus;
- deterministic challenge economics;
- deterministic winner settlement;
- repair certificates;
- bounded liveness and expiry;
- pull-payment credits;
- global accounting invariant.

The single-address design avoids asynchronous cross-contract settlement wiring while retaining non-trivial protocol architecture.

### Method map

| Method | Kind | Role |
| --- | --- | --- |
| `open_mission` | write, payable | freeze the work order and escrow the reward |
| `cancel_mission` | write | sponsor refund on an untouched mission |
| `compute_submission_commitment` | view | browser-side commitment pre-computation |
| `commit_candidate` | write, payable | seal a candidate with the submission bond |
| `reveal_candidate` | write | reveal the exact SHA and evidence bundle |
| `examine_candidate` | write | artifact examination consensus |
| `review_candidate` | write | criterion-level repair consensus |
| `open_challenge` | write, payable | bonded challenge on one frozen criterion |
| `resolve_challenge` | write | challenge consensus and economics |
| `finalize_submission` | write | certificate, winner credit, settle the field |
| `expire_submission` / `expire_mission` | write | bounded liveness and expiry |
| `withdraw_credit` | write | pull-payment withdrawal |
| `get_mission` / `get_submission` / `get_challenge` / `get_certificate` | view | entity reads |
| `get_submission_for_commitment` / `find_latest_mission_by_sponsor` | view | recovery helpers |
| `get_credit` / `list_missions` / `list_submissions` / `list_certificates` / `get_stats` | view | market and accounting reads |

## Evidence bundle

A revealed candidate submits 2–6 HTTPS evidence entries. `COMMIT` and `DIFF` are mandatory. `CI` is mandatory when the sponsor freezes `ci_required=true`.

Supported evidence kinds: `COMMIT`, `DIFF`, `CI`, `TEST`, `ISSUE`, `DOC`.

The contract does not trust contributor notes as facts. Validators must establish identity and criterion results from fetched evidence.

## Criterion roll-up

Every frozen criterion must appear exactly once with `SATISFIED`, `FAILED`, or `NOT_PROVEN`. The overall verdict is not free-form:

```
any FAILED
or scope violation
or forbidden change
or required CI failure
    => REJECTED

otherwise any NOT_PROVEN
    => INCONCLUSIVE

otherwise
    => QUALIFIED
```

This mechanical roll-up prevents a leader from returning `QUALIFIED` while one required criterion is missing or failed.

## Money model

At mission creation:

- native `gl.message.value` is the reward;
- submission bond = max(0.0001 GEN, 1% of reward);
- challenge bond = max(0.0002 GEN, 2% of reward).

Semantic consensus never calculates money. Deterministic code applies the result.

A rejected challenge bond moves into the reward escrow as winner bonus. An upheld challenge refunds the challenger bond and splits the candidate's bond between challenger reward and sponsor compensation. A finalized candidate receives reward + rejected-challenge bonus + its own submission bond as claimable credit.

The exposed accounting invariant is:

```
total_deposited =
    reward_escrow
  + submission_escrow
  + challenge_escrow
  + total_claimable
  + total_withdrawn
```

## Repair certificate

Finalization creates a certificate hash over network and contract, mission id, frozen spec hash, exact candidate SHA, assessment capsule hash, winner, and finalization time.

`get_certificate(mission_id)` returns the public repair certificate and the final criterion statuses.

## Frontend application

The web application is a Vite + React single-page app with no backend state mirror. Views:

- `#/` — hero-first product page and live missions
- `#/missions` — on-chain market browse/search
- `#/missions/:id` — frozen spec, candidates, artifact review, criterion review, challenge and finalization
- `#/open` — funded work-order creation
- `#/workbench` — browser reveal recovery + on-chain credit withdrawal
- `#/certificates` — finalized repair certificates
- `#/protocol` — trust model and settlement boundary

The visual system: light workshop paper, machined work-order plates, ruler rails, cut-corner panels, industrial microtype and hard signal colors.

## Browser wallet

The wallet layer uses only standard injected EIP-1193 calls: `eth_accounts`, `eth_requestAccounts`, `eth_chainId`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`.

To participate, open the app with MetaMask installed and connect. If the wallet is not on Studionet, the app requests a chain switch to chain `61999` and adds the canonical RPC automatically on first use.

## Configuring the contract address

The live address is pinned inside the repository at [`deployments/studionet.json`](deployments/studionet.json), so the app works out of the box — locally, on GitHub clones, and on Vercel — with **no environment variables**. If the contract ever moves to a new address, update it directly in the code at exactly one place:

1. `contract.address` in [`deployments/studionet.json`](deployments/studionet.json) — the canonical record committed to the repository (deploy scripts rewrite it automatically); or
2. `VITE_RIVET_CONTRACT` in `.env.local` — an optional local override for development; never required in production.

## Local checks

Python:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

genvm-lint check contracts/rivet.py --json
pytest tests/direct/ -v
```

Studionet smoke against the live release:

```bash
RIVET_CONTRACT=0x610a3787effC958d3693ad9f747c3a8896540844 gltest tests/integration/ -v -s --network studionet
```

Web application (no env file needed — the address ships in the repo):

```bash
npm install
npm run build
npm run dev
```

Node scripts:

```bash
node scripts/read-release.mjs         # print the canonical release summary
node scripts/verify-deployment.mjs    # prove on-chain source == repository source
node scripts/live-stats.mjs           # live protocol stats from the chain (read-only)
node scripts/live-roundtrip.mjs       # funded deposit → refund → withdraw probe (needs test key)
node scripts/generate-icons.mjs       # regenerate PNG icons into public/icons/
```

A full walkthrough, including negative paths, is in [docs/TESTING.md](docs/TESTING.md). Hands-on live testing with MetaMask from VSCode is covered in [docs/LIVE_TESTING_VSCODE.md](docs/LIVE_TESTING_VSCODE.md). Copy-paste mission fixtures for manual live testing (four scenarios with field maps and expected outcomes) live in [samples/](samples/README.md). Shipping to GitHub and Vercel is covered in [docs/RELEASING.md](docs/RELEASING.md).

## Deploy

Use the built-in stable network preset:

```bash
genlayer network set studionet
genlayer network info
npm install
genlayer deploy
```

`deploy/deployScript.ts` refuses a client whose chain id is not `61999`. On success it waits for finalization, confirms successful execution, reads the deployed schema/stats, writes `deployments/studionet.json`, rewrites `deployments/pending.json` for crash recovery, and writes the exact address into `.env.local`.

Then verify the immutable deployment:

```bash
genlayer schema <ADDRESS>
genlayer code <ADDRESS>
genlayer call <ADDRESS> get_stats
```

Do not claim the release is live until the deployed source matches this repository and the live flow in [docs/LIVE_DEMO.md](docs/LIVE_DEMO.md) has actually completed.

## Quality evidence

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/LIVE_DEMO.md](docs/LIVE_DEMO.md)

## Repository layout

```
contracts/rivet.py            Intelligent Contract (single address, many domains)
deploy/deployScript.ts        Chain-locked deploy + verify + address propagation
deployments/                  Canonical network records (studionet.json is live)
scripts/                      Node utilities: icons, release reader, deployment verifier
public/icons/                 Generated PNG icons (scripts/generate-icons.mjs)
docs/                         Architecture, security, testing, releasing, live walkthrough
tests/direct/                 Deterministic unit suite (mocked web + LLM)
tests/integration/            Studionet smoke suite (reads the live release)
src/                          Web application (Vite + React)
  config/network.ts           Chain + contract address resolution (one place)
  lib/                        Wallet, client, reveal recovery, formatting
  views/                      Market, mission detail, open, workbench, certificates, protocol
  components/                 Shell, plates, pills, ticker, activity feed
```

## Honest limitations

GenLayer consensus judges the supplied public evidence; it does not create objective truth. Git hosting pages can be unavailable, dynamic CI pages can change, redirects are not cryptographic provenance, and natural-language criteria can be written badly. Rivet reduces those risks with frozen criteria, exact SHA binding, criterion-level results, fail-closed states, independent replay and a challenge window. It does not eliminate them.
