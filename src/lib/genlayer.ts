import { assertFinalizedSuccess } from "./receipt";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant, type CalldataEncodable } from "genlayer-js/types";
import { CONTRACT_ADDRESS, RPC_URL, assertReleaseConfig, isConfigured } from "../config/network";
import { provider, ensureStudionet } from "./wallet";

assertReleaseConfig();

export type Mission = Record<string, any>;
export type Submission = Record<string, any>;
export type Challenge = Record<string, any>;

export function readClient() {
  return createClient({ chain: studionet });
}

export function requireContract() {
  if (!isConfigured()) {
    throw new Error("No contract address configured. Set VITE_RIVET_CONTRACT or update deployments/studionet.json.");
  }
  return CONTRACT_ADDRESS as `0x${string}`;
}

export function writeClient(address: string) {
  const p = provider();
  if (!p) throw new Error("No injected EIP-1193 wallet available");
  return createClient({ chain: studionet, account: address as `0x${string}`, provider: p });
}

export async function read(functionName: string, args: CalldataEncodable[] = []) {
  return readClient().readContract({
    address: requireContract(),
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    jsonSafeReturn: true,
  });
}

export async function write(address: string, functionName: string, args: CalldataEncodable[] = [], value = 0n): Promise<string> {
  await ensureStudionet();
  const client = writeClient(address);
  return client.writeContract({ address: requireContract(), functionName, args, value });
}

export async function waitFinal(hash: string) {
  let receipt: unknown;
  for (let attempt = 0; attempt < 240; attempt++) {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "eth_getTransactionByHash", params: [hash] }),
    });
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "Studionet receipt lookup failed");
    receipt = payload.result;
    const raw = receipt as { status?: string | number; status_name?: string; statusName?: string } | null;
    const status = raw?.status ?? raw?.status_name ?? raw?.statusName;
    if (status === "FINALIZED" || status === 7) break;
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  assertFinalizedSuccess(receipt);
  return receipt;
}

/** Extracts a human-readable reason from wallet/RPC/contract errors. */
export function friendlyError(e: any): string {
  const parts: string[] = [];
  for (const candidate of [e?.shortMessage, e?.details, e?.reason, e?.data?.message, e?.cause?.shortMessage, e?.cause?.message, e?.message]) {
    if (typeof candidate === "string" && candidate) parts.push(candidate);
  }
  const blob = parts.join(" | ");
  const bracketed = blob.match(/\[(?:EXPECTED|LLM_ERROR)\][^\]"|]{3,180}/);
  if (bracketed) return bracketed[0].replace(/\s+/g, " ").trim();
  if (/internal error was received/i.test(blob)) {
    return "The network rejected the request during simulation. Check that every field satisfies the work order rules (evidence count, HTTPS URLs, CI source when required, bonds and timings), then try again.";
  }
  return parts[0] || "The transaction failed.";
}

export const api = {
  getStats: (): Promise<Record<string, any>> => read("get_stats") as any,
  listMissions: (offset = 0, count = 24): Promise<{ items: Mission[]; total: string }> => read("list_missions", [offset, count]) as any,
  getMission: (id: string): Promise<Mission> => read("get_mission", [id]) as any,
  listSubmissions: (id: string): Promise<Submission[]> => read("list_submissions", [id]) as any,
  getSubmission: (id: string): Promise<Submission> => read("get_submission", [id]) as any,
  getChallenge: (id: string): Promise<Challenge> => read("get_challenge", [id]) as any,
  listCertificates: (offset = 0, count = 24): Promise<{ items: Mission[]; total: string }> => read("list_certificates", [offset, count]) as any,
  getCertificate: (id: string): Promise<Record<string, any>> => read("get_certificate", [id]) as any,
  getCredit: (address: string): Promise<string> => read("get_credit", [address]) as any,
  computeCommitment: (missionId: string, contributor: string, candidate: string, evidenceJson: string, salt: string): Promise<string> =>
    read("compute_submission_commitment", [missionId, contributor, candidate, evidenceJson, salt]) as any,
  findLatestBySponsor: (sponsor: string): Promise<string> => read("find_latest_mission_by_sponsor", [sponsor]) as any,
  getSubmissionForCommitment: (commitment: string): Promise<string> => read("get_submission_for_commitment", [commitment]) as any,
};
