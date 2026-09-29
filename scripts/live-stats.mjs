#!/usr/bin/env node
/**
 * Prints the live protocol stats from the canonical Studionet contract.
 * Read-only, free, and safe to run any time:
 *
 *   node scripts/live-stats.mjs
 */
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import { readFileSync } from "node:fs";

const record = JSON.parse(readFileSync("deployments/studionet.json", "utf8"));
const address = record?.contract?.address;
if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) {
  console.error("deployments/studionet.json has no live contract address");
  process.exit(1);
}

const client = createClient({ chain: studionet });
const gen = (atto) => {
  const value = BigInt(atto || "0");
  const whole = value / 10n ** 18n;
  const frac = (value % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "").slice(0, 6);
  return frac ? `${whole}.${frac}` : whole.toString();
};

const stats = await client.readContract({
  address,
  functionName: "get_stats",
  args: [],
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  jsonSafeReturn: true,
});

console.log("");
console.log("  Rivet · live protocol stats");
console.log(`  contract             ${address}`);
console.log(`  ${record.explorer}/address/${address}`);
console.log("  ─────────────────────────────────────────");
console.log(`  missions             ${stats.missions}`);
console.log(`  submissions          ${stats.submissions}`);
console.log(`  challenges           ${stats.challenges}`);
console.log(`  finalized repairs    ${stats.finalized_repairs}`);
console.log(`  rejected candidates  ${stats.rejected_candidates}`);
console.log(`  upheld challenges    ${stats.upheld_challenges}`);
console.log("  ─────────────────────────────────────────");
console.log(`  reward escrow        ${gen(stats.reward_escrow_atto)} GEN`);
console.log(`  submission escrow    ${gen(stats.submission_escrow_atto)} GEN`);
console.log(`  challenge escrow     ${gen(stats.challenge_escrow_atto)} GEN`);
console.log(`  claimable credit     ${gen(stats.claimable_atto)} GEN`);
console.log(`  withdrawn            ${gen(stats.withdrawn_atto)} GEN`);
console.log(`  accounting balanced  ${stats.accounting_balanced ? "yes" : "NO — investigate"}`);
console.log(`  admin controls       ${stats.admin_controls ? "PRESENT — unexpected" : "none"}`);
console.log("  ─────────────────────────────────────────");
console.log("");

const missions = await client.readContract({
  address,
  functionName: "list_missions",
  args: [0, 8],
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  jsonSafeReturn: true,
});
const items = missions?.items || [];
if (items.length) {
  console.log("  latest missions:");
  for (const m of items.slice(-5).reverse()) {
    console.log(`    ${m.id} · ${m.status} · ${gen(m.reward_atto)} GEN · ${m.title.slice(0, 52)}`);
  }
  console.log("");
}
