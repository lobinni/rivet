# Live testing in VSCode with MetaMask

A complete, hands-on test plan for the live Rivet release on GenLayer
Studionet (chain `61999`), run from Visual Studio Code with MetaMask.

Contract under test:
[`0x610a3787effC958d3693ad9f747c3a8896540844`](https://explorer-studio.genlayer.com/address/0x610a3787effC958d3693ad9f747c3a8896540844)
— recorded in `deployments/studionet.json` and used by every command below.

The plan has four layers, from cheapest to most real:

| Layer | What it proves | Cost |
| --- | --- | --- |
| 0 — Read-only live checks | the chain serves the exact release this repo ships | free |
| 1 — Web UI + MetaMask flow | every user path, signed by your own wallet | small test GEN |
| 2 — Funded roundtrip script | deposit → refund → credit → withdrawal, end to end | ~0.001 GEN probe, returned |
| 3 — Deterministic pytest suite | every branch of the contract logic, mocked consensus | free, offline |

---

## 0. Setup inside VSCode

1. Install: **VSCode**, **Node.js 20+**, **Python 3.10+**, and **MetaMask**
   (browser extension). No VSCode extension is strictly required; the
   integrated terminal is enough. The official MetaMask browser flows with
   Chrome/Edge/Firefox all work.
2. Open the project: `File → Open Folder…` → the repository root.
3. Open two integrated terminals (`Terminal → New Terminal`, then split):
   - **Terminal A** for the web app,
   - **Terminal B** for scripts/python.
4. One-time installs:

```bash
npm install                      # Terminal A or B — web app + genlayer-js
python -m venv .venv             # Terminal B — python tooling
.venv\Scripts\activate           # Windows PowerShell
# source .venv/bin/activate      # macOS/Linux
pip install -r requirements.txt
```

---

## 1. Prepare MetaMask for Studionet (chain 61999)

**Automatic (recommended):** skip ahead to Layer 1, press **Connect wallet**
in the app — it requests `wallet_switchEthereumChain` and, if needed,
`wallet_addEthereumChain` with the canonical parameters for you.

**Manual network entry** (MetaMask → Settings → Networks → Add network):

| Field | Value |
| --- | --- |
| Network name | GenLayer Studionet |
| RPC URL | `https://studio.genlayer.com/api` |
| Chain ID | `61999` |
| Currency symbol | `GEN` |
| Block explorer | `https://explorer-studio.genlayer.com` |

**Fund the test account.** Studionet is a hosted test network — you need a
little test GEN (never use real funds here):

- Open GenLayer Studio at `https://studio.genlayer.com`, select your
  account, and press the faucet (💧) button, or
- use the official faucet portal `https://testnet-faucet.genlayer.foundation`
  and bridge/route to your Studionet account if instructed there.

---

## 2. Layer 0 — read-only live checks (Terminal B)

These hit the live chain but never send a transaction:

```bash
node scripts/read-release.mjs        # prints the canonical release record
node scripts/verify-deployment.mjs   # chain id + on-chain source vs contracts/rivet.py
node scripts/live-stats.mjs          # live protocol stats + latest missions
```

Expected: the verification script ends with
`OK: the Studionet release matches this repository`, and the stats script
shows `accounting balanced  yes` and `admin controls  none`.

Full read-only gltest smoke (requires the python venv from step 0):

```bash
# PowerShell
$env:RIVET_CONTRACT = "0x610a3787effC958d3693ad9f747c3a8896540844"
gltest tests/integration/ -v -s --network studionet

# bash
RIVET_CONTRACT=0x610a3787effC958d3693ad9f747c3a8896540844 gltest tests/integration/ -v -s --network studionet
```

---

## 3. Layer 1 — the Web UI flow with MetaMask (Terminal A + browser)

```bash
npm run dev        # Terminal A → http://localhost:5173
```

Open the printed URL in the browser where MetaMask lives.

> Copy-paste fixtures: [samples/README.md](../samples/README.md) ships four
> ready scenarios (drill, happy path, CI-gated, limits) with the exact value
> for every input below — use them instead of inventing data on the fly.

### 3.1 Connect and chain guard

- Press **Connect wallet** → approve in MetaMask → the app offers to switch
  to Studionet; approve it.
- Header now shows your truncated address and a live network chip.
- **Negative test:** switch MetaMask to any other network and reload — the
  header turns into a "Switch to 61999" prompt and funded actions stay
  disabled. Switch back.

### 3.2 Sponsor: fund a mission (Account 1)

- Go to **Open mission**. Fill a small real fixture: repository + issue URLs,
  a frozen base SHA, 2–3 criteria, scope/forbidden/evidence policies, reward
  e.g. `0.02 GEN`, deadline ≥ 6 hours, challenge window 15–60 minutes.
- Press **Fund work order** → confirm in MetaMask → watch the notice move
  *Confirm in MetaMask → waiting for consensus → Finalized*.
- Click the resulting work-order plate link. Verify on the explorer that the
  write appears against the contract address.

### 3.3 Contributor: commit + reveal (Account 2)

- In MetaMask, switch to a second account (same wallet UI), reload, connect.
- Open your mission plate → **Seal a candidate**: paste the 40-char candidate
  SHA and 2–6 HTTPS evidence sources (commit page + `.diff` page are
  mandatory; CI page too if you froze `CI required`).
- Confirm the bond spend. The Workbench now lists a **reveal payload** for
  this browser.
- Press **Reveal candidate** on the mission plate (or close the tab and come
  back — the Workbench restores the payload).

### 3.4 Anyone: run the two consensus rounds

- **Artifact examination** — press it; validators fetch your evidence and
  agree on identity/readiness. Expect `Artifact verified` (or an honest
  `Not ready` if CI is still running — the bond refunds, retry later).
- **Criterion review** — validators judge each frozen criterion. Expect
  `Qualified`; the bonded challenge window opens.

> Consensus rounds take longer than plain transfers (minutes, not seconds).
> The app polls until the transaction finalizes — don't close the notice.

### 3.5 Optional challenger (Account 3) and finalization

- During the window, a third account can **Open challenge** with a bond,
  naming one criterion plus an HTTPS regression URL; then **Resolve
  challenge** runs the third consensus and settles both bonds.
- With no (or a rejected) challenge, after the deadline press
  **Finalize** — a certificate issues and the winner becomes claimable credit.
- **Workbench → Withdraw credit** pays the winner: reward + bonus + own bond.
- Check the certificate in **Certificates** and via
  `get_certificate` on the explorer.

---

## 4. Layer 2 — funded roundtrip from the VSCode terminal

`node scripts/live-roundtrip.mjs` performs **open mission → cancel (refund)
→ withdraw credit** against the live contract using your MetaMask account
key — a full deposit-refund roundtrip that returns every atto and asserts
the accounting invariant afterwards.

1. Export the test key: MetaMask → account menu → **Account details →
   Show private key**. Use a **Studionet test account only**.
2. Set it for this terminal session only (never into a file, never commit):

```powershell
# Windows PowerShell
$env:RIVET_SENDER_PK = "0x<64-hex key>"
node scripts/live-roundtrip.mjs
$env:RIVET_SENDER_PK = $null     # clear when done

# bash
RIVET_SENDER_PK=0x<64-hex key> node scripts/live-roundtrip.mjs
```

Expected output: three submitted/finalized transactions with explorer links,
a credit check, then
`PASS: deposit → refund → credit → withdrawal roundtrip completed live on Studionet.`

Safety: the key lives only in the shell environment; `.env.local` is
git-ignored anyway; the script refuses to run without a well-formed key.

---

## 5. Layer 3 — deterministic contract suite (Terminal B)

```bash
.venv\Scripts\activate       # or: source .venv/bin/activate
genvm-lint check contracts/rivet.py --json
pytest tests/direct/ -v
```

Fully offline — web and LLM consensus are mocked, time is warped, and every
branch (happy path, rejections, non-decisions, challenges, expiry, pull
payments, invariant) is asserted. Optional VSCode polish: the **Python**
extension → `Python: Select Interpreter` → pick `.venv` → tests run from the
Testing sidebar.

---

## 6. Verify everything on the explorer

- Contract home (all writes appear here):
  `https://explorer-studio.genlayer.com/address/0x610a3787effC958d3693ad9f747c3a8896540844`
- Every transaction hash printed by the app or scripts is clickable:
  `https://explorer-studio.genlayer.com/tx/<hash>`
- CLI equivalents: `genlayer schema <ADDRESS>` · `genlayer code <ADDRESS>` ·
  `genlayer call <ADDRESS> get_stats`

---

## 7. Troubleshooting

| Symptom | Likely cause → fix |
| --- | --- |
| Commit fails at the RPC layer with "RLP string ends with N superfluous bytes" | A current Studionet read-path condition rejects view calls carrying larger calldata (it affects the `compute_submission_commitment` helper view, not transactions). The app now seals the digest locally with a byte-identical replica of the contract's canonicalizer and only cross-checks the view when the network cooperates — commits and reveals are unaffected. |
| Connect does nothing | No injected provider → install MetaMask; one wallet extension at a time |
| "Switch to 61999" persists | MetaMask stayed on another chain → approve the switch, or add the network manually (table above) |
| Funding/commit fails immediately | No test GEN → use the Studio 💧 faucet; check you're on 61999 |
| Notice waits a long time | Consensus rounds legitimately take minutes → keep the tab open; the app polls 240 × 15 s |
| Reveal rejected | Salt/evidence/SHA mismatch → re-open the Workbench payload from the same browser; never retype the bundle |
| Workbench is empty | localStorage is per-browser → reveal from the browser used at commit time |
| `live-roundtrip` credit check fails | Mission already touched or wrong account → run with a fresh funded account |
| RPC errors in scripts | Temporary Studionet congestion → rerun; scripts are idempotent except writes you confirm |

## 8. Sign-off checklist

- [ ] `node scripts/verify-deployment.mjs` prints OK
- [ ] `node scripts/live-stats.mjs` shows `accounting balanced yes`
- [ ] gltest integration suite green with `RIVET_CONTRACT` set
- [ ] MetaMask connect + 61999 switch works; wrong-network prompt works
- [ ] Full UI flow: open → commit → reveal → examine → review → (challenge) → finalize → withdraw
- [ ] `live-roundtrip.mjs` PASS with a MetaMask test account
- [ ] `pytest tests/direct/ -v` green
