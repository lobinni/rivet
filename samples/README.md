# Manual test samples for the live contract

Copy-paste fixtures for driving the live Rivet contract on Studionet by
hand, through the web UI with MetaMask. Every sample file under
`missions/` is structured the same way:

- `openMissionForm` — the exact value to paste into each input of the
  **Open mission** screen,
- `commitPanel` — the exact values for the **Seal a candidate** panel,
- `challengePanel` / `cancelDrill` / `validationDrill` — scenario extras,
- `expectedFlow` — what the protocol should honestly do, so you can pass or
  fail a run against a written expectation instead of guessing.

Live contract under test:
[`0x610a3787effC958d3693ad9f747c3a8896540844`](https://explorer-studio.genlayer.com/address/0x610a3787effC958d3693ad9f747c3a8896540844)

| Sample | Scenario | Cost (max at risk) |
| --- | --- | --- |
| `missions/01-hello-world-drill.json` | full pipeline on real public evidence | 0.0011 GEN (reward returns if you qualify) |
| `missions/02-own-fixture-happy-path.json` | end-to-end on your own repo: finalize + certificate + withdraw | 0.0202 GEN (all returned on the happy path) |
| `missions/03-ci-required.json` | CI-gated evidence + NOT_READY negative drill | 0.0202 GEN (bond refunds on NOT_READY) |
| `missions/04-stress-limits.json` | caps, rendering, cancel refund, form validation | 0.001 GEN (refunded by the cancel drill) |

Prerequisites (once): MetaMask connected on chain `61999` via the app's
**Connect wallet** button, plus a little test GEN from the Studio faucet
(💧 in `https://studio.genlayer.com`). Run the app with `npm run dev`.

---

## 1. Field map — where every sample value goes

### Open mission screen (`#/open`)

| UI input | JSON key in the sample | Rules the field must pass |
| --- | --- | --- |
| Mission title | `"Mission title"` | 4–120 characters |
| Repository URL | `"Repository URL"` | must start `https://` |
| Defect / issue URL | `"Defect / issue URL"` | must start `https://` |
| Frozen base commit | `"Frozen base commit"` | exactly 40 hex characters |
| Target branch | `"Target branch"` | non-empty |
| Problem statement | `"Problem statement"` | ≥ 20 characters |
| Criteria rows (+ Add criterion) | `"criteria"` array | 1–8 rows; text ≥ 8 chars; hint optional |
| Scope policy | `"Scope policy"` | ≥ 8 characters |
| Forbidden changes | `"Forbidden changes"` | ≥ 4 characters |
| Evidence policy | `"Evidence policy"` | ≥ 8 characters |
| Reward · GEN | `"Reward · GEN"` | 0.001–20; bond preview updates live |
| Closes in | `"Closes in"` | pick the matching option |
| Challenge window | `"Challenge window"` | pick the matching option |
| CI evidence toggle | `"CI evidence"` | Optional / Required — must match the sample |

### Seal a candidate panel (on the mission plate)

| UI input | JSON key | Rules |
| --- | --- | --- |
| Candidate commit SHA | `"Candidate commit SHA"` | exactly 40 hex characters |
| Evidence rows: kind select | `evidence[].kind` | COMMIT + DIFF mandatory; CI mandatory when frozen in |
| Evidence rows: URL | `evidence[].url` | `https://`, all unique |
| Evidence rows: note | `evidence[].note` | ≥ 4 characters, human description |

### Challenge panel (during a qualified window)

| UI input | JSON key |
| --- | --- |
| Frozen criterion select | `"Criterion"` |
| Regression evidence URL | `"Regression evidence URL"` |
| Claim | `"Claim"` (≥ 12 chars) |

---

## 2. Scenario 01 — the 4-minute Hello-World drill

Do this one first; it proves your wallet, bonds and consensus on **real
public evidence** for a worst-case loss of 0.0011 GEN.

1. **Connect** MetaMask (account A) on Studionet. Run `npm run dev`, open
   the app, press Connect wallet, approve the chain switch.
2. Open `#/open` and paste every field from
   `01-hello-world-drill.json → openMissionForm`. The derived-economics chips
   should read **Submission bond 0.0001 GEN** and **Challenge bond 0.0002 GEN**.
3. Press **Fund work order · 0.001 GEN escrow**, confirm in MetaMask, wait
   for the Finalized notice, then open the work-order plate link.
4. Switch MetaMask to account B (a sponsor cannot compete), connect, open
   the plate → **Seal a candidate · Start**. Paste `commitPanel` values:
   the candidate SHA and the two evidence rows (COMMIT + DIFF).
5. Press **Commit · 0.0001 GEN bond**, confirm, wait for finalization.
   The **Workbench** now shows one reveal payload.
6. Press **Reveal candidate** on the plate; confirm; wait for finalization.
7. Press **Run artifact examination** → expect *Artifact verified* (real
   ancestry, real diff).
8. Press **Run criterion review** → healthy outcome is *Qualified*;
   *Inconclusive* refunds the bond and ends the run — both are documented
   in `expectedFlow`.
9. If qualified: wait the 15-minute window (the chip counts down), press
   **Finalize · issue certificate**, then **Workbench → Withdraw credit**.
10. Verify: certificate appears in `#/certificates`; the explorer address
    page shows all five writes; `node scripts/live-stats.mjs` reports one
    more mission and stays balanced.

## 3. Scenario 02 — happy path on your own fixture

1. Build the throwaway repo in [fixture-repo.md](fixture-repo.md); keep the
   two SHAs it produces.
2. Replace every `<YOU>` / `<base SHA>` / `<fix SHA>` placeholder in
   `02-own-fixture-happy-path.json`, then run the same nine steps as
   scenario 01 with those values.
3. Extra steps: from account C, rehearse the **challenge panel** during the
   30-minute window using the `challengePanel` block, then let the window
   lapse (or resolve the challenge) and finalize.
4. Finish in the Workbench: the winner credit (~0.0202 GEN) withdraws into
   the contributor wallet; the certificate lists all three criterion rows.

## 4. Scenario 03 — CI-gated mission

Identical to scenario 02 with `03-ci-required.json`, plus two drills:

- **Bundle drill:** delete the CI evidence row and press Commit → the
  client refuses before any signature (CI was frozen in).
- **NOT_READY drill:** commit while the Actions run is still orange, run
  artifact examination → *Not ready*, bond refunded. Re-commit after the
  run turns green (`33`-style new salt is handled by the app automatically).

## 5. Scenario 04 — limits, validation and the sponsor refund

1. Fill the form from `04-stress-limits.json`: 8 criteria (the cap — the
   *Add criterion* button stops working at 8), long statement, 30-day
   window, 24-hour challenge window. Fund 0.001 GEN.
2. Open the plate and check the renderer: all 8 criteria numbered, policies
   side-by-side, escrow plate reads 0.001 GEN.
3. Run the `validationDrill` entries in a *second* form attempt — each must
   be blocked client-side with a readable message.
4. Run the `cancelDrill`: cancel while untouched → status *Cancelled*,
   credit 0.001 GEN, withdraw in the Workbench.

### Cancelling from a script (sample 04 step)

The cancel control is intentionally not in the UI. Use a one-liner variant
of the roundtrip script: set `RIVET_SENDER_PK` to the sponsor's test key
and call `cancel_mission` with the mission id — the pattern is exactly the
middle step of `scripts/live-roundtrip.mjs`, or simply rerun that script:

```bash
RIVET_SENDER_PK=0x<test key> node scripts/live-roundtrip.mjs
```

> The roundtrip always cancels its own freshly opened probe mission, so it
> doubles as a repeatable cancel-path check.

---

## 6. Timing expectations

| Step | Typical wait |
| --- | --- |
| open / commit / reveal / finalize / withdraw | 30 s – 2 min each |
| artifact examination / criterion review / challenge resolution | a few minutes each (validators fetch + judge) |
| challenge window | exactly what you picked: 15 min, 30 min, 1 h, 24 h |

If a notice sits at "waiting for consensus", leave the tab open — the app
polls for up to an hour.

## 7. Pass criteria for a manual session

- [ ] every funded write finalized without a revert (explorers show them on the contract page)
- [ ] every predicted status in `expectedFlow` matched what the plates show
- [ ] all refunds arrived as claimable credit and withdrew exactly once
- [ ] `node scripts/verify-deployment.mjs` and `node scripts/live-stats.mjs`
      still green after your runs, with `accounting balanced: yes`
