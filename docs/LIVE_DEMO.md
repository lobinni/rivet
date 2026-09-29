# Live walkthrough

This is the canonical end-to-end flow on GenLayer Studionet that proves the
release behaves the way the docs claim. It uses real GEN, one public fixture
repository, and at least two funded wallets (a sponsor and a contributor).
A challenger wallet is optional.

## Fixture

Prepare a small public repository with:

1. a real defect and an open issue describing it,
2. a base commit SHA recorded **before** the fix,
3. a candidate commit that repairs the defect,
4. a CI run bound to the candidate SHA (GitHub Actions page is fine),
5. the commit page and the `.diff` page publicly fetchable over HTTPS.

## Step 0 — confirm the live release

The contract is already live on Studionet at
[`0x610a3787effC958d3693ad9f747c3a8896540844`](https://explorer-studio.genlayer.com/address/0x610a3787effC958d3693ad9f747c3a8896540844)
and `deployments/studionet.json` records it. Re-prove the release before
touching money:

```bash
node scripts/verify-deployment.mjs   # chain id + on-chain source vs repository
node scripts/read-release.mjs        # release summary
genlayer call 0x610a3787effC958d3693ad9f747c3a8896540844 get_stats
```

For a fresh deployment in the future, `genlayer network set studionet` +
`genlayer deploy` rewrites the record, the address and the verification
flags automatically.

## Step 1 — sponsor funds a mission

In the app (`#/open`) with the sponsor wallet:

- title, repository URL, issue URL, base SHA, target branch,
- 2–4 criteria with evidence hints,
- scope policy, forbidden changes, evidence policy,
- `ci_required = true`, deadline between 1 hour and 30 days out,
- challenge window between 15 minutes and 24 hours,
- reward ≥ 0.001 GEN (approved in MetaMask as native value).

Verify with `get_mission` that the spec hash is set and the escrow equals the
reward.

## Step 2 — contributor commits and reveals

With the contributor wallet on the mission page:

1. Fill the candidate SHA and the evidence bundle (commit page, `.diff`
   page, CI run page, optional notes).
2. The app calls the `compute_submission_commitment` view, stores the reveal
   payload in the browser Workbench, then sends `commit_candidate` with the
   exact submission bond.
3. Send `reveal_candidate` inside the 30-minute reveal window.

Closing the browser between the two steps is safe: Workbench restores the
payload.

## Step 3 — artifact examination

Anyone sends `examine_candidate`. Validators fetch every evidence URL and
agree on identity and readiness. Expect `ARTIFACT_VERIFIED`. If CI is still
running the honest result is `NOT_READY` and the bond is refunded — re-commit
after CI completes.

## Step 4 — criterion review

Send `review_candidate`. Validators judge each frozen criterion and the
roll-up fixes the verdict. Expect `QUALIFIED`; the mission enters the bonded
challenge window.

## Step 5 — challenge window

Two paths:

- **No challenge:** after the deadline, send `finalize_submission`. The
  recipient receives a certificate hash and winner credit.
- **Bonded challenge:** a challenger posts the challenge bond naming one
  frozen criterion plus an HTTPS evidence URL, then `resolve_challenge` runs
  the third consensus. `UPHELD` ejects the candidate (mission reopens);
  `REJECTED` moves the bond into the winner bonus; `INCONCLUSIVE` refunds it.

## Step 6 — winner withdrawal

The winner's credit is visible in the Workbench. `withdraw_credit` pays out
reward + bonus + own submission bond. `get_stats` must remain balanced after
the withdrawal.

## Step 7 — certificate

`get_certificate(mission_id)` returns the mission id, both SHAs, spec hash,
capsule hash, certificate hash, winner and the final criterion statuses. The
certificate is public and requires no wallet.

## Completion checklist

- [x] deployment record live (`deployments/studionet.json`)
- [ ] integration suite green (`RIVET_CONTRACT=0x610a3787effC958d3693ad9f747c3a8896540844 gltest tests/integration/ -v -s --network studionet`)
- [ ] full funded flow above completed against the live release
- [ ] certificate readable on the explorer and in `#/certificates`
