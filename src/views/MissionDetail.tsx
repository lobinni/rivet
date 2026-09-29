import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, Ban, ExternalLink, FileLock2, Flag, Gavel,
  Hourglass, Loader2, PackageCheck, Plus, ScanSearch, ShieldAlert, Timer, Trash2,
} from "lucide-react";
import { api, friendlyError, Mission, Submission, waitFinal, write } from "../lib/genlayer";
import { isConfigured } from "../config/network";
import { useWallet } from "../lib/wallet-context";
import { payloadsFor, randomSalt, storePayload, dropPayload } from "../lib/reveal";
import { computeCommitmentLocally, parseEvidenceLocally } from "../lib/commitment";
import {
  attoToGen, countdown, CRITERION_RESULT, MISSION_STATUS, prettyTime,
  repoName, shortHash, shortSha, SUBMISSION_STATUS, Tone,
} from "../lib/format";
import { AddressChip, Dot, EmptyState, KeyValue, Pill, Reveal, SkeletonRows, TxNotice, TxPhase } from "../components/ui";
import { cn } from "../utils/cn";

const EVIDENCE_KINDS = ["COMMIT", "DIFF", "CI", "TEST", "ISSUE", "DOC"];

interface EvidenceRow {
  kind: string;
  url: string;
  note: string;
}

function useTick(ms = 30_000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function useAction(after: () => void) {
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const run = useCallback(
    async (fnName: string, args: any[] = [], value = 0n, address?: string | null) => {
      if (!address) return;
      setPhase("signing");
      setError(undefined);
      setHash(undefined);
      try {
        const h = await write(address, fnName, args, value);
        setHash(h);
        setPhase("pending");
        await waitFinal(h);
        setPhase("finalized");
        after();
        setTimeout(() => setPhase("idle"), 4000);
      } catch (e: any) {
        setError(friendlyError(e));
        setPhase("error");
      }
      return phase;
    },
    [after, phase]
  );

  return { phase, hash, error, run };
}

function FactRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5">
      <span className="micro text-muted">{k}</span>
      <span className="text-right text-sm font-semibold">{v}</span>
    </div>
  );
}

function SpecPlate({ mission }: { mission: Mission }) {
  const meta = MISSION_STATUS[mission.status] || { label: mission.status, tone: "off" as Tone, blurb: "" };
  return (
    <div className="plate cut">
      <div className="rail-x" />
      <div className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill tone={meta.tone}>{meta.label}</Pill>
          {(mission.ci_required === true || mission.ci_required === "true") && (
            <Pill tone="info">CI required</Pill>
          )}
          <span className="micro text-muted">Work order {mission.id}</span>
        </div>
        <h1 className="display mt-5 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">{mission.title}</h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted">{mission.problem_statement}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={mission.repository_url} target="_blank" rel="noreferrer" className="chip hover:border-ink transition-colors">
            <ExternalLink size={12} /> {repoName(mission.repository_url)}
          </a>
          <a href={mission.issue_url} target="_blank" rel="noreferrer" className="chip hover:border-ink transition-colors">
            <ExternalLink size={12} /> Defect report
          </a>
          <span className="chip">Base {shortSha(mission.base_commit)}</span>
          <span className="chip">Branch {mission.target_branch}</span>
        </div>

        <div className="hairline-dash my-7" />

        <p className="micro mb-3 text-muted">Frozen acceptance criteria</p>
        <div className="grid gap-2.5">
          {(mission.criteria || []).map((c: any, i: number) => (
            <div key={c.id} className="flex items-start gap-3 border border-line-soft bg-bg/60 px-4 py-3">
              <span className="micro grid h-6 w-6 flex-none place-items-center border border-line bg-paper text-ink">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold leading-snug">{c.text}</p>
                {c.evidence_hint && <p className="micro mt-1 text-muted">Hint · {c.evidence_hint}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 grid gap-2.5 md:grid-cols-3">
          {[
            { k: "Scope policy", v: mission.scope_policy },
            { k: "Forbidden changes", v: mission.forbidden_changes },
            { k: "Evidence policy", v: mission.evidence_policy },
          ].map((x) => (
            <div key={x.k} className="border border-line-soft bg-bg/60 p-4">
              <p className="micro mb-2 text-muted">{x.k}</p>
              <p className="text-[13px] leading-relaxed">{x.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EscrowPanel({ mission }: { mission: Mission }) {
  const reward = (() => {
    try {
      return (BigInt(mission.reward_atto || "0") + BigInt(mission.bonus_atto || "0")).toString();
    } catch {
      return "0";
    }
  })();
  return (
    <div className="plate cut p-6">
      <div className="flex items-center justify-between">
        <p className="micro text-muted">Escrow plate</p>
        <span className="stamp text-[10px] text-accent-dark">Frozen</span>
      </div>
      <p className="display mt-4 text-4xl font-extrabold text-accent-dark">
        {attoToGen(reward)} <span className="text-base text-muted">GEN</span>
      </p>
      {Number(mission.bonus_atto || 0) > 0 && (
        <p className="micro mt-1 text-muted">Includes {attoToGen(mission.bonus_atto)} GEN challenge bonus</p>
      )}
      <div className="hairline-dash my-5" />
      <div className="divide-y divide-line-soft">
        <FactRow k="Closes" v={`${prettyTime(mission.closes_at)} · ${countdown(mission.closes_at)}`} />
        <FactRow k="Submission bond" v={`${attoToGen(mission.submission_bond_atto)} GEN`} />
        <FactRow k="Challenge bond" v={`${attoToGen(mission.challenge_bond_atto)} GEN`} />
        <FactRow k="Challenge window" v={`${Math.round(Number(mission.challenge_window_seconds) / 60)} min`} />
        <FactRow k="Candidates" v={`${mission.submission_count} total · ${mission.active_submissions} active`} />
        <FactRow k="Challenges" v={String(mission.challenge_count)} />
        <FactRow k="Spec hash" v={shortHash(mission.spec_hash, 10, 8)} />
      </div>
      {mission.status === "CLOSED" && (
        <div className="mt-5 border border-accent-dark/40 bg-accent-soft p-4">
          <p className="micro mb-2 text-accent-dark">Settled · certificate issued</p>
          <KeyValue k="Winner" v={<AddressChip address={mission.winner} />} />
          <KeyValue k="Candidate" v={shortSha(mission.final_candidate_commit)} />
          <KeyValue k="Certificate" v={shortHash(mission.certificate_hash, 10, 8)} />
        </div>
      )}
    </div>
  );
}

function CandidateRow({ sub, me }: { sub: Submission; me: boolean }) {
  const meta = SUBMISSION_STATUS[sub.status] || { label: sub.status, tone: "off" as Tone };
  const artifact = sub.artifact || {};
  const review = sub.review || {};
  const artifactFlags: Array<[string, boolean]> = [
    ["Repo match", !!artifact.repository_matches],
    ["SHA bound", !!artifact.commit_bound],
    ["Diff present", !!artifact.diff_available],
    ["CI complete", !!artifact.ci_completed],
    ["CI passing", !!artifact.ci_passed],
  ];
  return (
    <div className={cn("plate cut-sm p-5", me && "border-accent-dark/50")}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Pill tone={meta.tone}>{meta.label}</Pill>
        {me && <span className="chip !border-accent-dark text-accent-dark">Your candidate</span>}
        <span className="micro text-muted">{sub.id}</span>
        <span className="ml-auto"><AddressChip address={sub.contributor} /></span>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted">
        <span>Candidate {shortSha(sub.candidate_commit) || "sealed"}</span>
        {sub.revealed_at && <span>Revealed {prettyTime(Date.parse(sub.revealed_at) / 1000)}</span>}
        {sub.challenge_deadline && Number(sub.challenge_deadline) > 0 && (sub.status === "QUALIFIED_PENDING" || sub.status === "CHALLENGED") && (
          <span className="flex items-center gap-1 text-[#936800]"><Hourglass size={12} /> Window {countdown(sub.challenge_deadline)}</span>
        )}
      </div>
        {artifact.status && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {artifactFlags.map(([label, ok]) => (
            <span key={label} className={cn("chip !py-1 !px-2.5 !text-[10px]", ok ? "text-accent-dark" : "text-muted opacity-60")}>
              {ok ? <BadgeCheck size={11} /> : <Ban size={11} />} {label}
            </span>
          ))}
        </div>
      )}
      {review.verdict && (
        <div className="mt-3.5 border-t border-line-soft pt-3.5">
          <p className="micro mb-2 text-muted">Criterion roll-up · verdict {(review.verdict || "").toLowerCase()}</p>
          <div className="flex flex-wrap gap-1.5">
            {(review.criteria || []).map((row: any) => {
              const r = CRITERION_RESULT[row.result] || { label: row.result, tone: "off" as Tone };
              return (
                <span key={row.id} className="chip !py-1 !px-2.5 !text-[10px]">
                  <Dot tone={r.tone} /> {row.id} · {r.label}
                </span>
              );
            })}
          </div>
          {review.basis && <p className="mt-2.5 text-xs leading-relaxed text-muted">{review.basis}</p>}
        </div>
      )}
    </div>
  );
}

function CommitPanel({ mission, address, after }: { mission: Mission; address: string; after: () => void }) {
  const [open, setOpen] = useState(false);
  const [sha, setSha] = useState("");
  const [rows, setRows] = useState<EvidenceRow[]>([
    { kind: "COMMIT", url: "", note: "" },
    { kind: "DIFF", url: "", note: "" },
    ...(mission.ci_required === true || mission.ci_required === "true" ? [{ kind: "CI", url: "", note: "" } as EvidenceRow] : []),
  ]);
  const [busy, setBusy] = useState<"compute" | "commit" | null>(null);
  const [error, setError] = useState("");
  const { phase, hash, error: txError } = useAction(after);
  const pending = payloadsFor(address).filter((p) => p.missionId === mission.id);

  if (mission.status !== "OPEN" && mission.status !== "QUALIFIED_PENDING") return null;
  if (address.toLowerCase() === String(mission.sponsor).toLowerCase()) return null;

  const deadline = Number(mission.closes_at);
  const commitWindowOk = Date.now() / 1000 + 1800 < deadline;

  const ciNeeded = mission.ci_required === true || mission.ci_required === "true";

  const setRow = (i: number, patch: Partial<EvidenceRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const canRemove = (index: number) => {
    const row = rows[index];
    if (rows.length <= 2) return false;
    if (ciNeeded && row.kind === "CI") return false;
    if (row.kind === "COMMIT" || row.kind === "DIFF") {
      return rows.filter((r) => r.kind === row.kind).length > 1;
    }
    return true;
  };

  const commit = async () => {
    setError("");
    const evidence = rows.filter((r) => r.url.trim());
    if (!/^[0-9a-fA-F]{40}$/.test(sha.trim())) return setError("Candidate commit must be a full 40-character git SHA.");
    if (evidence.length < 2 || evidence.length > 6) return setError("Provide between two and six evidence sources.");
    if (!evidence.some((r) => r.kind === "COMMIT") || !evidence.some((r) => r.kind === "DIFF"))
      return setError("A commit page and a diff page are mandatory.");
    if (ciNeeded && !evidence.some((r) => r.kind === "CI"))
      return setError("This mission froze CI evidence in — add a CI source (for example the Actions run page).");
    if (evidence.some((r) => !r.url.startsWith("https://") || r.note.trim().length < 4))
      return setError("Every source needs an https URL and a short note (at least 4 characters).");
    if (new Set(evidence.map((r) => r.url.trim())).size !== evidence.length)
      return setError("Evidence URLs must be unique.");
    const salt = randomSalt();
    const evidenceJson = JSON.stringify(evidence.map((r) => ({ kind: r.kind, url: r.url.trim(), note: r.note.trim() })));
    let parsed;
    try {
      parsed = parseEvidenceLocally(evidence, ciNeeded);
    } catch (e: any) {
      return setError(e?.message || "Evidence bundle is invalid.");
    }
    setBusy("compute");
    let localDigest = "";
    try {
      localDigest = await computeCommitmentLocally({
        missionId: mission.id,
        contributor: address,
        candidate: sha.trim(),
        evidence: parsed,
        salt,
      });
    } catch (e: any) {
      setBusy(null);
      return setError(e?.message || "Could not seal the digest in this browser.");
    }
    // Prefer the on-chain view when the read path is healthy; it is the same
    // deterministic computation and will overrule the local digest if Studionet
    // ever normalizes differently.
    let commitment = localDigest;
    try {
      const onchain = await api.computeCommitment(mission.id, address, sha.trim().toLowerCase(), evidenceJson, salt);
      if (/^[0-9a-f]{64}$/.test(String(onchain || ""))) commitment = String(onchain);
    } catch {
      /* read path unavailable — local digest already matches the contract's formula */
    }
    try {
      const bond = BigInt(mission.submission_bond_atto);
      setBusy("commit");
      const h = await write(address, "commit_candidate", [mission.id, commitment], bond);
      setBusy(null);
      setHashlessPending(h);
      await waitFinal(h);
      clearHashlessPending();
      const sid = await api.getSubmissionForCommitment(commitment).catch(() => "");
      dropPayload("");
      storePayload({
        missionId: mission.id,
        submissionId: typeof sid === "string" && sid.startsWith("rv-s-") ? sid : "",
        contributor: address,
        candidateCommit: sha.trim().toLowerCase(),
        evidenceJson,
        salt,
        storedAt: Math.floor(Date.now() / 1000),
      });
      after();
    } catch (e: any) {
      setBusy(null);
      clearHashlessPending();
      setError(friendlyError(e));
    }
  };

  // small local pending marker independent from useAction phases
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const setHashlessPending = (h: string) => setPendingHash(h);
  const clearHashlessPending = () => setPendingHash(null);

  return (
    <div className="plate cut p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="display text-lg font-bold">Seal a candidate</p>
          <p className="micro mt-1 text-muted">Bond {attoToGen(mission.submission_bond_atto)} GEN · reveal within 30 min</p>
        </div>
        {!open && (
          <button className="btn btn-sm btn-accent" onClick={() => setOpen(true)} disabled={!commitWindowOk}>
            <FileLock2 size={14} /> Start
          </button>
        )}
      </div>
      {!commitWindowOk && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#936800]">
          <Timer size={13} /> Too close to the deadline — a full 30-minute reveal window must fit.
        </p>
      )}
      {open && commitWindowOk && (
        <div className="mt-5 grid gap-4">
          <div>
            <label className="label">Candidate commit SHA</label>
            <input className="input" placeholder="40-character git commit SHA" value={sha} onChange={(e) => setSha(e.target.value)} />
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Evidence bundle</label>
              <button
                className="chip hover:border-ink"
                onClick={() => rows.length < 6 && setRows([...rows, { kind: "TEST", url: "", note: "" }])}
              >
                <Plus size={12} /> Add source
              </button>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="grid gap-2 border border-line-soft bg-bg/50 p-3 sm:grid-cols-[110px_1fr_auto]">
                <select className="input !py-2.5 text-xs" value={row.kind} onChange={(e) => setRow(i, { kind: e.target.value })}>
                  {EVIDENCE_KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <div className="grid gap-2">
                  <input className="input !py-2.5 text-xs" placeholder="https:// evidence URL" value={row.url} onChange={(e) => setRow(i, { url: e.target.value })} />
                  <input className="input !py-2.5 text-xs" placeholder="Short note (what this proves)" value={row.note} onChange={(e) => setRow(i, { note: e.target.value })} />
                </div>
                {canRemove(i) && (
                  <button className="chip self-start hover:border-danger hover:text-danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {error && <p className="flex items-center gap-2 text-xs text-danger"><ShieldAlert size={13} /> {error}</p>}
          {(pendingHash || phase !== "idle") && <TxNotice phase={pendingHash ? "pending" : phase} hash={pendingHash || hash} error={txError} />}
          <button className="btn btn-accent w-full" onClick={commit} disabled={busy !== null}>
            {busy === "compute" && <Loader2 size={15} className="spin" />}
            {busy === "compute" ? "Sealing the digest…" : busy === "commit" ? "Confirm in MetaMask…" : `Commit · ${attoToGen(mission.submission_bond_atto)} GEN bond`}
          </button>
          <p className="micro leading-relaxed text-muted">
            The digest binds this wallet, this mission, the chain and the exact bundle. Your reveal payload is stored in the Workbench of this browser.
          </p>
        </div>
      )}
      {pending.length > 0 && !open && (
        <a href="#/workbench" className="micro mt-4 flex items-center gap-1.5 text-accent-dark hover:underline">
          {pending.length} reveal payload{pending.length === 1 ? "" : "s"} waiting in your Workbench <ArrowUpRight size={12} />
        </a>
      )}
    </div>
  );
}

function RevealButton({ sub, address, after }: { sub: Submission; address: string; after: () => void }) {
  const payload = payloadsFor(address).find(
    (p) => (p.submissionId && p.submissionId === sub.id) || (!p.submissionId && p.missionId === sub.mission_id)
  );
  const { phase, hash, error, run } = useAction(after);
  if (sub.status !== "COMMITTED") return null;
  if (!payload) {
    return (
      <div className="border border-warn/50 bg-[#fdf4e2] p-4 text-xs leading-relaxed text-[#8d5132]">
        This sealed candidate is awaiting reveal, but no reveal payload lives in this browser. Restore it from the browser used at commit time, then reveal before the deadline.
      </div>
    );
  }
  return (
    <div className="grid gap-2.5">
      <TxNotice phase={phase} hash={hash} error={error} done="Candidate revealed. Anyone can now run artifact examination." />
      <button
        className="btn btn-sm btn-accent"
        onClick={() =>
          run("reveal_candidate", [sub.id, payload.candidateCommit, payload.evidenceJson, payload.salt], 0n, address).then(() =>
            dropPayload(payload.submissionId || sub.id)
          )
        }
      >
        <PackageCheck size={14} /> Reveal candidate
      </button>
    </div>
  );
}

function ChallengePanel({ mission, sub, address, after }: { mission: Mission; sub: Submission; address: string; after: () => void }) {
  const [open, setOpen] = useState(false);
  const [criterion, setCriterion] = useState((mission.criteria || [])[0]?.id || "");
  const [url, setUrl] = useState("");
  const [claim, setClaim] = useState("");
  const [error, setError] = useState("");
  const { phase, hash, run, error: txError } = useAction(after);
  if (sub.status !== "QUALIFIED_PENDING") return null;
  if (address.toLowerCase() === sub.contributor.toLowerCase()) return null;
  if (Date.now() / 1000 >= Number(sub.challenge_deadline)) return null;

  const submit = () => {
    setError("");
    if (!url.startsWith("https://")) return setError("Evidence URL must use https.");
    if (claim.trim().length < 12) return setError("Describe the regression in at least a sentence.");
    run("open_challenge", [sub.id, criterion, url.trim(), claim.trim()], BigInt(mission.challenge_bond_atto), address);
  };

  return (
    <div className="plate cut border-warn/60 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="display text-lg font-bold">Challenge this candidate</p>
          <p className="micro mt-1 text-muted">Bond {attoToGen(mission.challenge_bond_atto)} GEN · window {countdown(sub.challenge_deadline)}</p>
        </div>
        {!open && (
          <button className="btn btn-sm btn-ghost" onClick={() => setOpen(true)}>
            <Flag size={14} /> Open challenge
          </button>
        )}
      </div>
      {open && (
        <div className="mt-5 grid gap-4">
          <div>
            <label className="label">Frozen criterion to defeat</label>
            <select className="input" value={criterion} onChange={(e) => setCriterion(e.target.value)}>
              {(mission.criteria || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.id} — {c.text.slice(0, 64)}{c.text.length > 64 ? "…" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Regression evidence URL</label>
            <input className="input" placeholder="https:// public failing run, log, or report" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="label">Claim</label>
            <textarea className="input" placeholder="What exactly defeats this criterion for the candidate SHA?" value={claim} onChange={(e) => setClaim(e.target.value)} />
          </div>
          {error && <p className="flex items-center gap-2 text-xs text-danger"><ShieldAlert size={13} /> {error}</p>}
          <TxNotice phase={phase} hash={hash} error={txError} />
          <button className="btn w-full" onClick={submit}>
            <Gavel size={15} /> Post challenge · {attoToGen(mission.challenge_bond_atto)} GEN bond
          </button>
        </div>
      )}
    </div>
  );
}

function ActionDock({ mission, subs, address, after }: { mission: Mission; subs: Submission[]; address: string; after: () => void }) {
  const examine = useAction(after);
  const review = useAction(after);
  const resolve = useAction(after);
  const finalize = useAction(after);
  const expire = useAction(after);

  const revealed = subs.filter((s) => s.status === "REVEALED");
  const verified = subs.filter((s) => s.status === "ARTIFACT_VERIFIED");
  const pendingSub = subs.find((s) => s.status === "QUALIFIED_PENDING");
  const challenged = subs.find((s) => s.status === "CHALLENGED");
  const mineCommitted = subs.filter((s) => s.status === "COMMITTED" && s.contributor.toLowerCase() === address.toLowerCase());
  const expiredCommitted = subs.filter((s) => s.status === "COMMITTED" && Date.now() / 1000 >= Number(s.reveal_deadline));
  const now = Date.now() / 1000;

  return (
    <div className="grid gap-4">
      {mineCommitted.map((s) => (
        <RevealButton key={s.id} sub={s} address={address} after={after} />
      ))}

      {revealed.map((s) => (
        <div key={s.id} className="grid gap-2.5">
          <TxNotice phase={examine.phase} hash={examine.hash} error={examine.error} done="Artifact examination finalized." />
          <button className="btn btn-sm btn-ghost" onClick={() => examine.run("examine_candidate", [s.id], 0n, address)}>
            <ScanSearch size={14} /> Run artifact examination · {s.id}
          </button>
        </div>
      ))}

      {verified.map((s) =>
        mission.status === "OPEN" && !mission.pending_submission ? (
          <div key={s.id} className="grid gap-2.5">
            <TxNotice phase={review.phase} hash={review.hash} error={review.error} done="Criterion review finalized." />
            <button className="btn btn-sm btn-ghost" onClick={() => review.run("review_candidate", [s.id], 0n, address)}>
              <BadgeCheck size={14} /> Run criterion review · {s.id}
            </button>
          </div>
        ) : null
      )}

      {challenged && (
        <div className="grid gap-2.5">
          <div className="border border-warn/50 bg-[#fdf4e2] p-4 text-xs leading-relaxed text-[#8d5132]">
            A bonded challenge is open against candidate {challenged.id}. Resolving it runs the third consensus round and settles both bonds.
          </div>
          <TxNotice phase={resolve.phase} hash={resolve.hash} error={resolve.error} done="Challenge resolved." />
          <button className="btn btn-sm" onClick={() => resolve.run("resolve_challenge", [challenged.challenge_id], 0n, address)}>
            <Gavel size={14} /> Resolve challenge {challenged.challenge_id}
          </button>
        </div>
      )}

      {pendingSub && now >= Number(pendingSub.challenge_deadline) && (
        <div className="grid gap-2.5">
          <TxNotice phase={finalize.phase} hash={finalize.hash} error={finalize.error} done="Mission settled. Certificate issued and credit assigned." />
          <button className="btn btn-sm btn-accent" onClick={() => finalize.run("finalize_submission", [pendingSub.id], 0n, address)}>
            <PackageCheck size={14} /> Finalize · issue certificate
          </button>
        </div>
      )}

      {mission.status === "OPEN" && !mission.pending_submission && now >= Number(mission.closes_at) && (
        <div className="grid gap-2.5">
          <TxNotice phase={expire.phase} hash={expire.hash} error={expire.error} />
          <button className="btn btn-sm btn-ghost" onClick={() => expire.run("expire_mission", [mission.id], 0n, address)}>
            <Hourglass size={14} /> Expire mission · refund sponsor
          </button>
        </div>
      )}

      {expiredCommitted.map((s) => (
        <button key={s.id} className="btn btn-sm btn-ghost" onClick={() => expire.run("expire_submission", [s.id], 0n, address)}>
          <Hourglass size={14} /> Expire unrevealed · {s.id}
        </button>
      ))}
    </div>
  );
}

export default function MissionDetail({ id }: { id: string }) {
  useTick();
  const wallet = useWallet();
  const configured = isConfigured();
  const [mission, setMission] = useState<Mission | null>(null);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(() => {
    if (!configured || !id) return;
    api
      .getMission(id)
      .then((m) => {
        setMission(m);
        setMissing(false);
      })
      .catch(() => setMissing(true));
    api.listSubmissions(id).then(setSubs).catch(() => setSubs([]));
  }, [configured, id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  const sortedSubs = useMemo(() => (subs || []).slice().reverse(), [subs]);

  return (
    <section className="mx-auto max-w-[1220px] px-4 py-12 md:px-8 md:py-16">
      <a href="#/missions" className="micro flex items-center gap-1.5 text-muted hover:text-ink transition-colors">
        <ArrowLeft size={13} /> Market board
      </a>
      <div className="mt-6">
        {!configured ? (
          <EmptyState title="Deployment pending" body="This build has no contract address yet, so mission plates cannot be read." />
        ) : missing ? (
          <EmptyState title="Mission not found" body={`No work order with id ${id} exists on the deployed contract.`} />
        ) : !mission ? (
          <SkeletonRows rows={3} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
            <div className="grid gap-6 self-start">
              <Reveal>
                <SpecPlate mission={mission} />
              </Reveal>
              <Reveal delay={100}>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <p className="micro text-muted">Candidates · {sortedSubs.length}</p>
                    {subs === null && <Loader2 size={14} className="spin text-muted" />}
                  </div>
                  {sortedSubs.length === 0 && subs !== null && (
                    <div className="plate cut-sm p-6 text-sm text-muted">No sealed candidates yet. The first one sets the pace of this mission.</div>
                  )}
                  {sortedSubs.map((s) => (
                    <CandidateRow key={s.id} sub={s} me={wallet.address ? s.contributor.toLowerCase() === wallet.address.toLowerCase() : false} />
                  ))}
                </div>
              </Reveal>
            </div>
            <div className="grid gap-5 self-start lg:sticky lg:top-24">
              <Reveal delay={140}>
                <EscrowPanel mission={mission} />
              </Reveal>
              <Reveal delay={200} className="grid gap-5">
                {wallet.connected && wallet.correctNetwork ? (
                  <>
                    <CommitPanel mission={mission} address={wallet.address!} after={load} />
                    {mission.status === "QUALIFIED_PENDING" && subs
                      ? subs.filter((s) => s.status === "QUALIFIED_PENDING").map((s) => (
                          <ChallengePanel key={s.id} mission={mission} sub={s} address={wallet.address!} after={load} />
                        ))
                      : null}
                    <ActionDock mission={mission} subs={subs || []} address={wallet.address!} after={load} />
                  </>
                ) : (
                  <div className="plate cut border-accent-dark/40 bg-accent-soft/60 p-6">
                    <p className="display text-lg font-bold text-accent-dark">Join with MetaMask</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
                      Connect on Studionet chain 61999 to seal candidates, reveal patches, run consensus steps, challenge, or finalize. Reading is always free.
                    </p>
                  </div>
                )}
              </Reveal>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
