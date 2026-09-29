/**
 * Reveal recovery store.
 *
 * After a contributor commits, the salt and the exact evidence bundle must
 * survive a browser restart until the reveal is mined. Payloads live in
 * localStorage, keyed per wallet, and are removed once the reveal lands.
 */

const KEY = "rivet.reveal-payloads.v1";

export interface RevealPayload {
  missionId: string;
  submissionId: string;
  contributor: string;
  candidateCommit: string;
  evidenceJson: string;
  salt: string;
  storedAt: number;
}

function load(): RevealPayload[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: RevealPayload[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage may be unavailable; the flow still works while the tab stays open */
  }
}

export function storePayload(payload: RevealPayload) {
  const items = load().filter((x) => x.submissionId !== payload.submissionId);
  items.push(payload);
  save(items);
}

export function payloadsFor(address?: string | null): RevealPayload[] {
  const items = load();
  if (!address) return items;
  return items.filter((x) => x.contributor.toLowerCase() === address.toLowerCase());
}

export function dropPayload(submissionId: string) {
  save(load().filter((x) => x.submissionId !== submissionId));
}

export function randomSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
