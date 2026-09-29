export const TICKER_ITEMS = [
  "Commit",
  "Reveal",
  "Artifact examination",
  "Criterion review",
  "Bonded challenge",
  "Finalize",
  "GEN escrow",
  "Chain 61999",
  "No admin keys",
  "Pull payments",
  "Exact SHA binding",
  "Frozen criteria",
];

export interface ActivityItem {
  name: string;
  action: string;
  delta: string;
  tone: "live" | "info" | "warn";
}

export const ACTIVITY: ActivityItem[] = [
  { name: "Kestrel Ops", action: "Candidate sealed · bond locked", delta: "+1 slot", tone: "info" },
  { name: "Northlight", action: "Artifact verified by consensus", delta: "stage 2", tone: "live" },
  { name: "Vega Field", action: "Mission funded and frozen", delta: "escrow", tone: "info" },
  { name: "Juniper Lab", action: "Challenge window survived", delta: "final", tone: "live" },
  { name: "Moss Anchor", action: "Bonded challenge opened", delta: "review", tone: "warn" },
  { name: "Pale Signal", action: "Certificate issued on-chain", delta: "+GEN", tone: "live" },
];

export interface ProtocolStep {
  index: string;
  title: string;
  body: string;
  meta: string;
}

export const PROTOCOL_STEPS: ProtocolStep[] = [
  {
    index: "01",
    title: "Freeze the work order",
    body: "The sponsor escrows GEN and locks the acceptance criteria before anyone competes. Nothing on the plate can be edited afterwards.",
    meta: "Funding · spec hash",
  },
  {
    index: "02",
    title: "Commit, then reveal",
    body: "Contributors seal an exact candidate SHA plus a public evidence bundle, bonded. The reveal must match the digest that was sealed.",
    meta: "Sealed digest · 30 min window",
  },
  {
    index: "03",
    title: "Two validator passes",
    body: "Validators independently fetch the evidence twice: first to prove the artifact is exactly what was claimed, then to judge every frozen criterion.",
    meta: "Independent replay",
  },
  {
    index: "04",
    title: "Bonded challenge window",
    body: "A qualified patch sits exposed. Anyone can post a bond to defeat one named criterion with fresh public evidence.",
    meta: "Bonded disputes",
  },
  {
    index: "05",
    title: "Certificate and payout",
    body: "Survive the window and the mission settles: a public repair certificate issues, and reward plus bonds become withdrawable credit.",
    meta: "Settlement · pull payment",
  },
];

export const MONEY_ROWS = [
  { label: "Mission reward", value: "Escrowed in GEN at funding; paid to the first patch that survives the challenge window." },
  { label: "Submission bond", value: "1% of the reward, floor 0.0001 GEN. Forfeited on invalid or rejected candidates; refunded otherwise." },
  { label: "Challenge bond", value: "2% of the reward, floor 0.0002 GEN. Rejected challenges feed the winner bonus." },
  { label: "Upheld challenge", value: "Challenger bond refunded, plus half the defeated candidate's bond; the sponsor keeps the rest." },
  { label: "Accounting invariant", value: "Every deposited atto is always escrow, claimable credit, or withdrawn. Auditable in one call." },
];

export const EVIDENCE_KINDS = [
  { kind: "Commit", required: true, body: "The exact candidate commit page on the public host." },
  { kind: "Diff", required: true, body: "The patch against the frozen base, fetched as text." },
  { kind: "CI", required: "When frozen", body: "A completed, passing run bound to the candidate SHA." },
  { kind: "Test", required: false, body: "Focused regression coverage supporting a criterion." },
  { kind: "Issue", required: false, body: "The public defect report the patch answers." },
  { kind: "Doc", required: false, body: "Design notes or maintainer context worth judging." },
];

export const FAQ = [
  {
    q: "Who decides whether a patch qualifies?",
    a: "No single party. Validators each fetch the same public evidence and independently answer two narrow questions: is this the claimed artifact, and does it satisfy every frozen criterion. Their answers must agree field-by-field before anything settles.",
  },
  {
    q: "Can the model choose who gets paid?",
    a: "No. The semantic layer returns statuses only. All money movement — bonds, refunds, bonuses, winner credit — is computed by deterministic code that every validator replays identically.",
  },
  {
    q: "What happens when evidence is temporarily offline?",
    a: "The protocol records an explicit non-decision (source unavailable, not ready, or inconclusive) and refunds the bond. A flaky host can never silently become a rejection.",
  },
  {
    q: "Why commit and reveal instead of posting the patch?",
    a: "Sealing the digest first means the revealed patch, evidence bundle, wallet, mission, chain and contract are cryptographically bound. Nothing can be swapped after the fact, and no one can front-run the exact candidate.",
  },
  {
    q: "What stops griefing of a qualified patch?",
    a: "Challenges require a bond tied to one named frozen criterion. A rejected challenge loses the bond to the winner's bonus, while an upheld one splits the candidate's bond with the challenger.",
  },
  {
    q: "Is there an admin that can intervene?",
    a: "There is no admin key, owner switch, or upgrade path in the contract. Settlement is reproducible from the deployed source, and expiry cranks are permissionless.",
  },
];
