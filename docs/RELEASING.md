# Releasing: GitHub + Vercel

The web app is a static single-page build. There is **no backend, no database,
and no required environment variable** — the live contract address is
committed to the repository in `deployments/studionet.json` and read by the
app at build time. Updating the address is a code change, not an environment
change.

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Rivet: funded repair missions on GenLayer Studionet (live release)"
git branch -M main
git remote add origin https://github.com/<your-account>/rivet-studionet.git
git push -u origin main
```

Useful follow-ups:

```bash
# after any change to the release
node scripts/verify-deployment.mjs   # prove repo source == on-chain source
node scripts/read-release.mjs        # print the release summary
git add -A && git commit -m "release: update" && git push
```

`.gitignore` already excludes `node_modules`, `dist`, `.env.local`,
Python caches and transient deploy artifacts, so the repository stays clean.

## 2. Build on Vercel

1. **Import the repository** in Vercel (New Project → pick the GitHub repo).
2. **Framework preset:** `Vite` (auto-detected).
3. **Build command:** `npm run build` — **Output directory:** `dist` —
   **Install command:** `npm install`. All defaults work.
4. **Environment variables:** leave empty. Do not add a database URL, an RPC
   key, or a contract address — the app resolves the live contract from
   `deployments/studionet.json` inside the code.
5. Deploy.

Notes:

- Routing uses hash paths (`#/missions`, `#/open`, …), so **no SPA rewrite
  rules** are required; every Vercel URL just serves `index.html`.
- PNG icons and the favicon are served from `public/icons/` automatically.
- Every push to `main` redeploys automatically. If the contract address ever
  changes, edit `deployments/studionet.json`, commit, push — Vercel rebuilds
  with the new address. No environment edits.

## 3. After deploy — smoke the public URL

- Open the site, confirm the header shows the Studionet chip.
- Connect MetaMask on a wrong network once to confirm the switch prompt to
  chain 61999 appears.
- The market board should hydrate from the live contract within seconds.

## 4. Project scripts summary

| Command | Purpose |
| --- | --- |
| `node scripts/generate-icons.mjs` | regenerate all PNG app icons into `public/icons/` |
| `node scripts/read-release.mjs` | print the canonical release record |
| `node scripts/verify-deployment.mjs` | chain id + on-chain source vs repository source |
| `node scripts/live-stats.mjs` | live protocol stats from the chain (read-only) |
| `node scripts/live-roundtrip.mjs` | funded deposit → refund → withdraw probe (`RIVET_SENDER_PK`, test key only) |
| `npm run build` / `npm run dev` | production build / local dev of the web app |
| `pytest tests/direct/ -v` | deterministic contract suite (mocked consensus) |
| `RIVET_CONTRACT=0x610a3787effC958d3693ad9f747c3a8896540844 gltest tests/integration/ -v -s --network studionet` | live-read smoke of the release |

For the complete MetaMask + VSCode live testing walkthrough, see
[docs/LIVE_TESTING_VSCODE.md](LIVE_TESTING_VSCODE.md).

## 5. If the contract is redeployed

1. Deploy the new build (see README → Deploy) or reuse the recorded address.
2. Update `deployments/studionet.json` (the deploy script does it for you).
3. Run `node scripts/verify-deployment.mjs`.
4. Commit and push — done. GitHub, Vercel and every clone pick it up from
   the code itself.
