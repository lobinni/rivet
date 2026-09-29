#!/usr/bin/env node
/**
 * Verifies the canonical Studionet deployment recorded in
 * deployments/studionet.json — with zero extra tooling:
 *
 *   node scripts/verify-deployment.mjs
 *
 * Checks:
 *   1. the record is live and carries a well-formed address;
 *   2. the RPC answers with chain 61999;
 *   3. the on-chain source equals contracts/rivet.py after line-ending
 *      normalization (deployments made from Windows store CRLF bytes).
 *
 * Exit code 0 = released exactly as recorded, 1 = something is off.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const RECORD_PATH = "deployments/studionet.json";
const SOURCE_PATH = "contracts/rivet.py";
const CHAIN_HEX = "0xf22f";

const normalize = (text) => text.replace(/\r\n/g, "\n");
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

async function rpc(url, method, params = []) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const record = JSON.parse(readFileSync(RECORD_PATH, "utf8"));
const address = record?.contract?.address || "";
const failures = [];

if (record.status !== "live") failures.push("record status is not live");
if (!/^0x[0-9a-fA-F]{40}$/.test(address)) failures.push("record has no well-formed contract address");
console.log(`network : ${record.network} (chain ${record.chainId})`);
console.log(`address : ${address || "—"}`);

if (!failures.length) {
  const chainId = await rpc(record.rpc, "eth_chainId");
  if (chainId !== CHAIN_HEX) failures.push(`RPC chain id is ${chainId}, expected ${CHAIN_HEX}`);
  else console.log(`chain   : ${parseInt(chainId, 16)} via ${record.rpc}`);

  const onChainB64 = await rpc(record.rpc, "gen_getContractCode", [address]);
  const onChain = Buffer.from(onChainB64, "base64").toString("utf8");
  const local = readFileSync(SOURCE_PATH, "utf8");
  const onChainNormalized = normalize(onChain);
  const localNormalized = normalize(local);

  if (onChainNormalized !== localNormalized) {
    failures.push("on-chain source differs from contracts/rivet.py even after line-ending normalization");
  } else {
    console.log(`source  : matches contracts/rivet.py (sha256 ${sha256(localNormalized).slice(0, 16)}…)`);
    if (onChain !== local) console.log("note    : deployed bytes use CRLF line endings; content is identical after normalization");
  }
  if (record.sourceSha256 && record.sourceSha256 !== sha256(localNormalized)) {
    failures.push("record sourceSha256 does not match contracts/rivet.py");
  }
}

if (failures.length) {
  console.error("\nFAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nOK: the Studionet release matches this repository.");
