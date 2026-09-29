import { getAddress } from "viem";
import { CONTRACT_ADDRESS, CHAIN_ID } from "../config/network";

/**
 * Local replica of the contract's commitment digest.
 *
 * The on-chain helper view `compute_submission_commitment` performs the same
 * computation, but Studionet's read path currently rejects calls with
 * larger calldata at the RPC layer. The commitment is fully deterministic:
 *
 *   sha256( canonical_json([
 *     "rivet-v1", NETWORK_ID, contract_address(EIP-55), mission_id,
 *     contributor(lowercase), candidate, parsed_evidence, salt,
 *   ]) )
 *
 * with canonical_json = sorted keys, comma/colon separators, raw unicode —
 * identical to the contract's canonicalizer. The contract re-verifies the
 * digest during reveal, so an incorrect local digest can never pass.
 */

const EVIDENCE_KINDS = ["COMMIT", "DIFF", "CI", "TEST", "ISSUE", "DOC"];

export interface EvidenceInput {
  kind: string;
  url: string;
  note: string;
}

export interface ParsedEvidence {
  id: string;
  kind: string;
  url: string;
  note: string;
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((k) => [k, canonicalize(value[k])])
    );
  }
  return value;
}

export function canonicalJson(value: any): string {
  return JSON.stringify(canonicalize(value));
}

/** Mirrors the contract's evidence parsing/validation exactly. */
export function parseEvidenceLocally(input: EvidenceInput[], ciRequired: boolean): ParsedEvidence[] {
  if (input.length < 2 || input.length > 6) {
    throw new Error("Evidence must contain between two and six sources.");
  }
  const seen = new Set<string>();
  const kinds = new Set<string>();
  const out = input.map((raw, i) => {
    const kind = String(raw.kind || "").trim().toUpperCase();
    if (!EVIDENCE_KINDS.includes(kind)) throw new Error(`Unsupported evidence kind "${raw.kind}".`);
    const url = String(raw.url || "").trim();
    if (!url.startsWith("https://")) throw new Error(`Evidence ${i + 1} URL must use https.`);
    const note = String(raw.note || "").trim();
    if (note.length < 4 || note.length > 1300) throw new Error(`Evidence ${i + 1} note must be 4–1300 characters.`);
    if (seen.has(url)) throw new Error("Evidence URLs must be unique.");
    seen.add(url);
    kinds.add(kind);
    return { id: `E${i + 1}`, kind, url, note };
  });
  if (!kinds.has("COMMIT") || !kinds.has("DIFF")) throw new Error("Evidence requires COMMIT and DIFF sources.");
  if (ciRequired && !kinds.has("CI")) throw new Error("This mission requires a CI evidence source.");
  return out;
}

export function contractAddressDigestForm(): string {
  // GenLayer serializes addresses EIP-55-checksummed.
  return getAddress(CONTRACT_ADDRESS.toLowerCase() as `0x${string}`);
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeCommitmentLocally(params: {
  missionId: string;
  contributor: string;
  candidate: string;
  evidence: ParsedEvidence[];
  salt: string;
}): Promise<string> {
  const payload = [
    "rivet-v1",
    String(CHAIN_ID),
    contractAddressDigestForm(),
    params.missionId,
    params.contributor.toLowerCase(),
    params.candidate.toLowerCase(),
    params.evidence,
    params.salt.toLowerCase(),
  ];
  return sha256Hex(canonicalJson(payload));
}
