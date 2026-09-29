# Rivet architecture

Rivet is a funded public-software repair market. One Intelligent Contract on
GenLayer Studionet (chain 61999) holds every domain of the protocol; the web
application is a stateless client that renders chain state and submits
transactions from the visitor's own MetaMask wallet.

## System overview

```
Browser (MetaMask, EIP-1193)
   │  reads (free, finalized state)        writes (signed by the user)
   ▼                                     ▼
genlayer-js client ───────────────► GenLayer Studionet RPC (https://studio.genlayer.com/api)
                                            │
                                            ▼
                              contracts/rivet.py (one address)
                                            │
                          validators re-fetch public evidence (gl.nondet.web)
                                            │
                                            ▼
                          semantic consensus → deterministic settlement
```

There is no backend, no state mirror, no indexer, and no signer owned by the
project. If the web app disappeared, the contract would still be fully usable
through any GenLayer client.

## Single-address contract, many internal domains

`contracts/rivet.py` keeps separate concerns in one deployment to avoid
asynchronous cross-contract settlement wiring:

| Domain | Responsibility |
| --- | --- |
| Work-order registry | immutable spec, spec hash, lifecycle, expiry |
| Escrow ledgers | reward / submission / challenge escrows and the accounting invariant |
| Commit–reveal | sealed candidates, salt binding, reveal timeouts |
| Replay protection | one active candidate SHA per mission, single-use commitments |
| Artifact consensus | is this the claimed repo/SHA/diff/CI bundle? |
| Repair consensus | per-criterion `SATISFIED` / `FAILED` / `NOT_PROVEN` roll-up |
| Challenge consensus | bonded disputes on one frozen criterion |
| Settlement | deterministic payouts after semantic status is fixed |
| Certificates | public repair certificate per finalized mission |
| Credits | pull-payment withdrawals |

## Deterministic / non-deterministic boundary

Non-deterministic (validator consensus, `gl.vm.run_nondet_unsafe` with an
independent `validator_fn` replay):

1. artifact examination (`RIVET_ARTIFACT_EXAMINER_V1`),
2. criterion repair review (`RIVET_REPAIR_JUDGE_V1`),
3. challenge resolution (`RIVET_CHALLENGE_JUDGE_V1`).

Each prompt returns a mechanically checked shape
(`_normalize_artifact` / `_normalize_review` / `_normalize_challenge`). The
review verdict must equal the roll-up of its criterion rows; an inconsistent
answer is rejected even if every validator produced it.

Deterministic (plain Python, runs identically on every validator):

- all money movement derived from semantic status,
- bond arithmetic, escrow accounting, the global invariant,
- commit/reveal hashing, SHA and URL validation,
- state machine transitions, timeouts, expiry, certificates,
- the `validator_fn` comparisons.

The LLM never chooses a payout amount and never writes state; it emits a
status, and deterministic code settles.

## Commit / reveal binding

The commitment is the SHA-256 of a canonical JSON payload:

```
["rivet-v1", NETWORK_ID, contract_address, mission_id,
 contributor_address, candidate_commit, evidence_bundle, salt]
```

Because the payload binds the chain, the contract address, the mission, the
wallet and the exact evidence bundle, a commitment cannot be replayed across
missions, networks, or deployments, and the revealed content cannot deviate
from the sealed claim. The browser seals the digest with a local replica of
the contract's canonicalizer (`src/lib/commitment.ts`) and cross-checks it
against the `compute_submission_commitment` view whenever the chain's read
path is healthy; the authoritative check is always the contract's own
recomputation at reveal.

## Liveness

- `REVEAL_TIMEOUT` — 30 minutes to reveal a commitment.
- Mission window — 1 hour to 30 days; the full reveal window must fit before close.
- Challenge window — 15 minutes to 24 hours per mission; an unresolved
  challenge outcome extends a nearly-expired window by 5 minutes so a late
  resolution never steals finalization time.
- `expire_submission` / `expire_mission` are permissionless crank calls that
  keep the market from stalling even if every applicant disappears.

## Failure states are explicit

`SOURCE_UNAVAILABLE`, `NOT_READY`, `INCONCLUSIVE` and `PROTOCOL_BLOCKED` are
recorded non-decisions with defined bond treatment. They never decay into
rejection or qualification, which keeps a flaky host or a pending CI run from
silently deciding money.

## Web application layering

```
src/config/network.ts   chain id, RPC, explorer, contract address resolution
src/lib/wallet.ts       injected EIP-1193 provider, chain guard, wallet hook
src/lib/genlayer.ts     typed read/write client over genlayer-js (this file
                        is the only module that talks to the RPC)
src/lib/reveal.ts       reveal payload persistence in localStorage
src/lib/format.ts       GEN/atto formatting, abbreviations, status labels
src/views/*             one view per route, all stateless
```

State flows one way: the chain is the source of truth; views subscribe to it
on an interval and after every confirmed write. Nothing in the client can
fabricate a protocol result, which is why the app can safely run as a static
build.
