# Security model

## Trust assumptions

- **GenLayer validator set.** Optimistic democracy on Studionet executes the
  three non-deterministic judgments. We assume honest validator majority for
  semantic results; we assume nothing about validators for money movement.
- **Public evidence hosts.** Repository, diff and CI pages must be retrievable
  over HTTPS. Unavailability is a recorded non-decision, not a failure or a
  success.
- **The deployed contract address.** All protocol authority lives at the
  address recorded in `deployments/studionet.json`. No admin key, upgrade
  proxy, owner function, or backdoor exists in the contract.

## What is forbidden by construction

| Risk | Mitigation |
| --- | --- |
| Sponsor picks a favorite after seeing patches | criteria + spec hash are frozen at funding; sponsors cannot compete or judge |
| Contributor self-certifies | commit/reveal hides the candidate until sealed; validators re-fetch evidence |
| One leader fabricates a verdict | validators independently replay the same prompt and compare normalized fields |
| LLM touches money | LLM output is normalized to statuses; all value moves in deterministic code |
| Commitment replay | digest binds chain id, contract address, mission, wallet, evidence, salt |
| Same SHA double-entered | `candidate_reservations` enforces one active candidate per mission |
| Griefing a qualified patch | challenges require a bond; rejected challenges feed the winner bonus |
| Host flakiness steals a win | `SOURCE_UNAVAILABLE` / `NOT_READY` refund bonds instead of rejecting |
| Stalled market | permissionless expiry cranks + bounded reveal/challenge windows |
| Locked value | pull-payment credits + a global accounting invariant exposed in `get_stats` |
| Silent upgrade | no proxy; redeployment means a new address and new certificates |

## Prompt-injection posture

All fetched pages, issue text, notes, code, diffs and CI logs are treated as
**data**. Each examiner prompt instructs the model to ignore embedded
instructions, and the normalization layer refuses structurally inconsistent
answers (for example `VERIFIED` with a false identity flag, or `QUALIFIED`
with a `FAILED` criterion).

## Deterministic invariants checked on every release

1. `total_deposited = reward_escrow + submission_escrow + challenge_escrow
   + total_claimable + total_withdrawn` — asserted in `get_stats` and by the
   integration suite.
2. `admin_controls = false` — no privileged method exists.
3. Deployed source hash == repository source hash — the deploy script refuses
   to announce a release otherwise.
4. Chain id `61999` and the canonical RPC — enforced in the deploy script, in
   the web config, and in the integration suite.

## Frontend boundary

- The app never asks for keys; MetaMask signs everything.
- Only five EIP-1193 methods are used: `eth_accounts`,
  `eth_requestAccounts`, `eth_chainId`, `wallet_switchEthereumChain`,
  `wallet_addEthereumChain`.
- Reads are free view calls against finalized state; the UI disables actions
  whenever the wallet, chain, or configured address is wrong instead of
  failing silently.

## Known limitations

Consensus judges public evidence; it does not create objective truth. Dynamic
CI pages may change after review, hosting pages can redirect, and badly
written criteria produce bad judgments. Frozen criteria, exact SHA binding,
fail-closed states, challenge windows well after qualification, and honest
non-decision states reduce — but do not remove — these risks.
