const ATTO = 10n ** 18n;

export function attoToGen(atto: string | bigint | number, maxDecimals = 4): string {
  try {
    const value = BigInt(atto);
    const whole = value / ATTO;
    const frac = value % ATTO;
    if (frac === 0n) return whole.toString();
    const digits = frac.toString().padStart(18, "0").replace(/0+$/, "").slice(0, maxDecimals);
    return `${whole}.${digits}`;
  } catch {
    return "0";
  }
}

export function genToAtto(gen: string): bigint {
  const cleaned = gen.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(cleaned)) throw new Error("Enter a valid GEN amount");
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole) * ATTO + BigInt((frac + "000000000000000000").slice(0, 18));
}

export function shortHash(value?: string, head = 6, tail = 4): string {
  if (!value) return "—";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function shortSha(value?: string): string {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 10) : value;
}

export function prettyTime(unixSeconds?: string | number): string {
  const ts = Number(unixSeconds);
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function countdown(unixSeconds?: string | number): string {
  const ts = Number(unixSeconds);
  if (!ts) return "—";
  const delta = ts - Math.floor(Date.now() / 1000);
  if (delta <= 0) return "ended";
  const d = Math.floor(delta / 86400);
  const h = Math.floor((delta % 86400) / 3600);
  const m = Math.floor((delta % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(m, 1)}m left`;
}

export type Tone = "live" | "info" | "warn" | "off" | "danger";

export const MISSION_STATUS: Record<string, { label: string; tone: Tone; blurb: string }> = {
  OPEN: { label: "Open", tone: "live", blurb: "Accepting sealed candidates" },
  QUALIFIED_PENDING: { label: "Challenge window", tone: "warn", blurb: "A qualified candidate is under bonded review" },
  CLOSED: { label: "Settled", tone: "info", blurb: "Certificate issued and reward credited" },
  EXPIRED: { label: "Expired", tone: "off", blurb: "Deadline passed without a winner" },
  CANCELLED: { label: "Cancelled", tone: "off", blurb: "Sponsor withdrew an untouched mission" },
};

export const SUBMISSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  COMMITTED: { label: "Sealed", tone: "info" },
  REVEALED: { label: "Revealed", tone: "info" },
  ARTIFACT_VERIFIED: { label: "Artifact verified", tone: "live" },
  SOURCE_UNAVAILABLE: { label: "Source unavailable", tone: "off" },
  NOT_READY: { label: "Not ready", tone: "warn" },
  INVALID_CANDIDATE: { label: "Invalid candidate", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
  INCONCLUSIVE: { label: "Inconclusive", tone: "off" },
  QUALIFIED_PENDING: { label: "Qualified", tone: "warn" },
  CHALLENGED: { label: "Challenged", tone: "warn" },
  QUALIFIED_FINAL: { label: "Winner", tone: "live" },
  REJECTED_CHALLENGE: { label: "Defeated", tone: "danger" },
  PROTOCOL_BLOCKED: { label: "Settled out", tone: "off" },
  UNREVEALED: { label: "Unrevealed", tone: "off" },
};

export const CRITERION_RESULT: Record<string, { label: string; tone: Tone }> = {
  SATISFIED: { label: "Satisfied", tone: "live" },
  FAILED: { label: "Failed", tone: "danger" },
  NOT_PROVEN: { label: "Not proven", tone: "off" },
};

export const dotClass: Record<Tone, string> = {
  live: "dot dot-live",
  info: "dot dot-info",
  warn: "dot dot-warn",
  off: "dot dot-off",
  danger: "dot dot-danger",
};

const AVATAR_PALETTES: Array<[string, string]> = [
  ["#dff3eb", "#087f71"],
  ["#f5e7ad", "#936800"],
  ["#eed4c6", "#8d5132"],
  ["#dce8e7", "#526568"],
  ["#07110e", "#35d5b4"],
  ["#e7ece6", "#07110e"],
];

export function avatarFor(seed: string): { bg: string; fg: string; initials: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [bg, fg] = AVATAR_PALETTES[h % AVATAR_PALETTES.length];
  const words = seed.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : seed.slice(0, 2)).toUpperCase();
  return { bg, fg, initials };
}

export function repoName(url?: string): string {
  if (!url) return "—";
  const clean = url.replace(/\/+$/, "");
  const parts = clean.split("/");
  return parts.slice(-2).join("/") || clean;
}
