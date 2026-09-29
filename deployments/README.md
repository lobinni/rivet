# Deployment records

This directory is the canonical record of where the Rivet Intelligent Contract
lives on each network. The release line is **GenLayer Studionet (chain 61999)
only**.

## `studionet.json` — live

The release is live:

- **Address:** [`0x610a3787effC958d3693ad9f747c3a8896540844`](https://explorer-studio.genlayer.com/address/0x610a3787effC958d3693ad9f747c3a8896540844)
- **Status:** `live`
- **Source check:** the on-chain code equals `contracts/rivet.py` after
  line-ending normalization (the deployment was uploaded with CRLF bytes;
  content is identical). The deployed schema also matches the schema compiled
  from this repository.
- **Re-verify anytime:** `node scripts/verify-deployment.mjs`.

The web application reads this file at build time, so the live address ships
with the code — no environment variables needed on Vercel or anywhere else.

## `pending.json`

Crash recovery used by `deploy/deployScript.ts` during future deployments: the
submitted deployment transaction is persisted **before** polling starts, so an
interrupted run resumes instead of redeploying. It is deleted after a
successful finalize and is git-ignored. If it ever exists with a mismatching
`sourceSha256`, the script refuses to continue until you resolve it manually.

## Changing the contract address

Downstream consumers never hard-code an address:

1. Update `contract.address` in `studionet.json` (the deploy script does this
   automatically), then commit — every clone and Vercel rebuild picks it up;
   or
2. Set `VITE_RIVET_CONTRACT` in `.env.local` for a local-only override.

Resolution lives in `src/config/network.ts` (environment first, this record
second). Rebuilding or restarting the dev server is enough — no code edits
anywhere else.
