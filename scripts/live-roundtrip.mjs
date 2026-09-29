#!/usr/bin/env node
/**
 * Funded live roundtrip against the canonical Studionet contract.
 *
 * This exercises real writes with a wallet you control and is safe by
 * design: every deposited atto comes back through the refund path.
 *
 * Steps executed:
 *   1. open_mission    — deposits the minimum reward (0.001 GEN)
 *   2. cancel_mission  — untouched missions refund into pull-payment credit
 *   3. withdraw_credit — credit returns to your wallet
 *   4. re-read stats   — accounting invariant must still balance
 *
 * Usage (PowerShell on Windows shown; bash uses `export`):
 *   $env:RIVET_SENDER_PK = "0x<your MetaMask private key for test funds>"
 *   node scripts/live-roundtrip.mjs
 *
 * Never commit the key. The account needs a little test GEN from the
 * Studionet faucet (💧 button in https://studio.genlayer.com).
 */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, TransactionHashVariant } from "genlayer-js/types";
import { readFileSync } from "node:fs";
import { assertFinalizedSuccess } from "../src/lib/receipt.js";

const record = JSON.parse(readFileSync("deployments/studionet.json", "utf8"));
const address = record?.contract?.address;
const pk = process.env.RIVET_SENDER_PK || process.env.RIVET_PRIVATE_KEY || "";

if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) {
  console.error("deployments/studionet.json has no live contract address");
  process.exit(1);
}
if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
  console.error("Set RIVET_SENDER_PK to a 0x-prefixed 64-hex private key (MetaMask → Account details → Show private key).");
  console.error("Use a Studionet test account only. Never commit keys.");
  process.exit(1);
}

const account = createAccount(pk);
const client = createClient({ chain: studionet, account });
const explorer = record.explorer;
const REWARD = 1_000_000_000_000_000n; // 0.001 GEN — the contract minimum

async function sendAndWait(label, functionName, args, value = 0n) {
  console.log(`\n→ ${label}`);
  const hash = await client.writeContract({ address, functionName, args, value });
  console.log(`  submitted  ${explorer}/tx/${hash}`);
  console.log("  waiting for consensus + finalization (can take a couple of minutes)…");
  const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, retries: 240, interval: 15_000 });
  assertFinalizedSuccess(receipt);
  console.log(`  finalized  ✔`);
  return receipt;
}

async function readStats() {
  return client.readContract({ address, functionName: "get_stats", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL, jsonSafeReturn: true });
}

console.log(`wallet    ${account.address}`);
console.log(`contract  ${address}`);
if (Number(await client.request({ method: "eth_chainId" })) !== 61999) {
  console.error("chain id mismatch — expected Studionet 61999");
  process.exit(1);
}

const before = await readStats();
console.log(`stats     missions ${before.missions} · balanced ${before.accounting_balanced}`);

const now = Math.floor(Date.now() / 1000);
const criteria = JSON.stringify([{ id: "C1", text: "Roundtrip probe: funds must escrow and refund losslessly.", evidence_hint: "accounting views" }]);
await sendAndWait("open_mission (deposits 0.001 GEN)", "open_mission", [
  "Roundtrip probe mission",
  "https://github.com/example/roundtrip-probe",
  "https://github.com/example/roundtrip-probe/issues/1",
  "8a95c7d1b75c8e4309d21698b5033de8c49b0c73",
  "main",
  "Probe mission used to verify live deposit and refund paths end to end.",
  criteria,
  "Scope is limited to the probe itself.",
  "No production impact allowed.",
  "No external evidence is required for this probe.",
  false,
  now + 3600,
  900,
], REWARD);

const missionId = await client.readContract({
  address,
  functionName: "find_latest_mission_by_sponsor",
  args: [account.address],
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  jsonSafeReturn: true,
});
console.log(`  mission    ${missionId} · ${explorer}/address/${address}`);

await sendAndWait("cancel_mission (refund enters pull-payment credit)", "cancel_mission", [missionId]);

const credit = await client.readContract({ address, functionName: "get_credit", args: [account.address], transactionHashVariant: TransactionHashVariant.LATEST_FINAL, jsonSafeReturn: true });
console.log(`  credit     ${credit} atto (expect ${REWARD})`);
if (String(credit) !== String(REWARD)) {
  console.error("  credit mismatch — stopping before withdrawal");
  process.exit(1);
}

await sendAndWait("withdraw_credit (GEN returns to your wallet)", "withdraw_credit", [account.address]);

const after = await readStats();
const balanced =
  BigInt(after.total_deposited_atto) ===
  BigInt(after.reward_escrow_atto) + BigInt(after.submission_escrow_atto) + BigInt(after.challenge_escrow_atto) + BigInt(after.claimable_atto) + BigInt(after.withdrawn_atto);

console.log(`\nstats     missions ${after.missions} · withdrawn +1 roundtrip · balanced ${balanced}`);
if (!balanced || after.accounting_balanced !== true) {
  console.error("accounting invariant broken after roundtrip");
  process.exit(1);
}
console.log("\nPASS: deposit → refund → credit → withdrawal roundtrip completed live on Studionet.");
