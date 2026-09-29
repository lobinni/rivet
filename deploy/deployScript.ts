import { assertFinalizedSuccess } from "../src/lib/receipt.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { TransactionStatus, TransactionHashVariant, type DecodedDeployData, type GenLayerClient, type GenLayerChain, type TransactionHash } from "genlayer-js/types";

const CHAIN = 61999;
const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const encode = (x: unknown) => JSON.stringify(x, (_, v) => typeof v === "bigint" ? v.toString() : v, 2) + "\n";
const canonical = (x: any): any => Array.isArray(x) ? x.map(canonical) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;

export default async function main(client: GenLayerClient<GenLayerChain>) {
  if (client.chain.id !== CHAIN || client.chain.rpcUrls.default.http[0] !== RPC) throw new Error("Release requires Studionet 61999 at the canonical RPC");
  if (Number(await client.request({ method: "eth_chainId" })) !== CHAIN) throw new Error("RPC chain mismatch");
  const code = readFileSync("contracts/rivet.py");
  const sha256 = createHash("sha256").update(code).digest("hex");
  mkdirSync("deployments", { recursive: true });
  mkdirSync("release-evidence", { recursive: true });
  // Persist the transaction before polling so an interrupted run never blindly redeploys.
  let tx: TransactionHash;
  if (existsSync("deployments/pending.json")) {
    const saved = JSON.parse(readFileSync("deployments/pending.json", "utf8"));
    if (saved.sourceSha256 !== sha256) throw new Error("Pending deployment belongs to different source; inspect it before redeploying");
    tx = saved.txHash;
  } else {
    tx = await client.deployContract({ code: new Uint8Array(code), args: [] }) as TransactionHash;
    writeFileSync("deployments/pending.json", encode({ txHash: tx, sourceSha256: sha256 }));
  }
  console.log(`Deployment submitted: ${tx}`);
  const receipt = await client.waitForTransactionReceipt({ hash: tx, status: TransactionStatus.FINALIZED, retries: 240, interval: 15_000 });
  writeFileSync("release-evidence/deployment-receipt.json", encode(receipt));
  assertFinalizedSuccess(receipt);
  const address = ((receipt.txDataDecoded as DecodedDeployData)?.contractAddress || receipt.data?.contract_address) as `0x${string}`;
  if (!address) throw new Error("Receipt has no contract address");
  const deployed = await client.getContractCode(address);
  if (deployed !== code.toString("utf8")) throw new Error("Deployed source differs from repository");
  const schema = await client.getContractSchema(address);
  const expectedSchema = await client.getContractSchemaForCode(new Uint8Array(code));
  if (JSON.stringify(canonical(schema)) !== JSON.stringify(canonical(expectedSchema))) throw new Error("Deployed schema differs from repository schema");
  writeFileSync("release-evidence/deployed-schema.json", encode(schema));
  const stats = await client.readContract({ address, functionName: "get_stats", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL, jsonSafeReturn: true }) as Record<string, unknown>;
  if (String(stats.chain_id) !== String(CHAIN) || stats.rpc !== RPC || stats.accounting_balanced !== true || stats.admin_controls !== false) throw new Error("Deployed release invariants failed");
  writeFileSync("release-evidence/deployment-stats.json", encode(stats));
  writeFileSync("deployments/studionet.json", encode({
    product: "Rivet",
    network: "studionet",
    chainId: CHAIN,
    rpc: RPC,
    explorer: EXPLORER,
    status: "live",
    deployedAt: new Date().toISOString(),
    sourceSha256: sha256,
    sourceVerified: true,
    schemaVerified: true,
    contract: { address, txHash: tx },
  }));
  writeFileSync(".env.local", [
    `VITE_RIVET_CONTRACT=${address}`,
    `VITE_GENLAYER_CHAIN_ID=${CHAIN}`,
    `VITE_GENLAYER_RPC_URL=${RPC}`,
    `VITE_GENLAYER_EXPLORER=${EXPLORER}`,
    "",
  ].join("\n"));
  rmSync("deployments/pending.json", { force: true });
  console.log(`Verified canonical Rivet deployment: ${address}`);
}
