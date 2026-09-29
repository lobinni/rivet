#!/usr/bin/env node
/**
 * Prints the canonical release summary from deployments/studionet.json.
 *
 *   node scripts/read-release.mjs
 */
import { readFileSync } from "node:fs";

const record = JSON.parse(readFileSync("deployments/studionet.json", "utf8"));
const address = record?.contract?.address || "";
const short = address ? `${address.slice(0, 10)}…${address.slice(-8)}` : "not deployed";

console.log("");
console.log("  Rivet release");
console.log("  ─────────────────────────────────────────");
console.log(`  product    ${record.product}`);
console.log(`  network    ${record.network} · chain ${record.chainId}`);
console.log(`  status     ${record.status}`);
console.log(`  contract   ${short}`);
console.log(`  rpc        ${record.rpc}`);
console.log(`  explorer   ${record.explorer}${address ? `/address/${address}` : ""}`);
if (record.contract?.txHash) console.log(`  deploy tx  ${record.explorer}/tx/${record.contract.txHash}`);
if (record.sourceSha256) console.log(`  source     sha256 ${record.sourceSha256.slice(0, 20)}… (normalized line endings)`);
console.log(`  verified   source ${record.sourceVerified ? "yes" : "no"} · schema ${record.schemaVerified ? "yes" : "no"}`);
console.log("  ─────────────────────────────────────────");
console.log("");
