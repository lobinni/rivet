import { useMemo, useState } from "react";
import { ArrowUpRight, Banknote, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { api, friendlyError, waitFinal, write } from "../lib/genlayer";
import { isConfigured } from "../config/network";
import { useWallet } from "../lib/wallet-context";
import { attoToGen, genToAtto } from "../lib/format";
import { EmptyState, Reveal, SectionHeading, TxNotice, TxPhase } from "../components/ui";

interface CriterionRow {
  id: string;
  text: string;
  hint: string;
}

const CLOSE_OPTIONS = [
  { label: "6 hours", seconds: 6 * 3600 },
  { label: "24 hours", seconds: 24 * 3600 },
  { label: "3 days", seconds: 3 * 86400 },
  { label: "7 days", seconds: 7 * 86400 },
  { label: "14 days", seconds: 14 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
];

const CHALLENGE_OPTIONS = [
  { label: "15 minutes", seconds: 900 },
  { label: "30 minutes", seconds: 1800 },
  { label: "1 hour", seconds: 3600 },
  { label: "6 hours", seconds: 6 * 3600 },
  { label: "12 hours", seconds: 12 * 3600 },
  { label: "24 hours", seconds: 24 * 3600 },
];

export default function OpenMission() {
  const wallet = useWallet();
  const configured = isConfigured();

  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState("");
  const [issue, setIssue] = useState("");
  const [base, setBase] = useState("");
  const [branch, setBranch] = useState("main");
  const [problem, setProblem] = useState("");
  const [criteria, setCriteria] = useState<CriterionRow[]>([
    { id: "C1", text: "", hint: "" },
    { id: "C2", text: "", hint: "" },
  ]);
  const [scope, setScope] = useState("");
  const [forbidden, setForbidden] = useState("");
  const [evidencePolicy, setEvidencePolicy] = useState("");
  const [ciRequired, setCiRequired] = useState(true);
  const [closeIdx, setCloseIdx] = useState(2);
  const [challengeIdx, setChallengeIdx] = useState(2);
  const [reward, setReward] = useState("0.05");

  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [doneId, setDoneId] = useState("");

  const bonds = useMemo(() => {
    try {
      const r = genToAtto(reward);
      const floor = 100_000_000_000_000n;
      const challengeFloor = 200_000_000_000_000n;
      const sub = r / 100n > floor ? r / 100n : floor;
      const ch = r / 50n > challengeFloor ? r / 50n : challengeFloor;
      return { sub: attoToGen(sub), ch: attoToGen(ch), ok: r >= 1_000_000_000_000_000n && r <= 20_000_000_000_000_000_000n };
    } catch {
      return { sub: "—", ch: "—", ok: false };
    }
  }, [reward]);

  const setCriterion = (i: number, patch: Partial<CriterionRow>) =>
    setCriteria((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const submit = async () => {
    if (!wallet.address) return;
    setError("");
    setDoneId("");
    const fail = (m: string) => setError(m);
    if (title.trim().length < 4 || title.trim().length > 120) return fail("Title must be 4–120 characters.");
    if (!repo.startsWith("https://") || !issue.startsWith("https://")) return fail("Repository and issue links must use https.");
    if (!/^[0-9a-fA-F]{40}$/.test(base.trim())) return fail("Base commit must be a full 40-character git SHA.");
    if (problem.trim().length < 20) return fail("Problem statement needs at least 20 characters.");
    if (criteria.some((c) => c.text.trim().length < 8)) return fail("Every criterion needs at least 8 characters of text.");
    if (!bonds.ok) return fail("Reward must be between 0.001 and 20 GEN.");
    if (scope.trim().length < 8 || forbidden.trim().length < 4 || evidencePolicy.trim().length < 8)
      return fail("Scope, forbidden changes and evidence policy are all required.");
    try {
      const value = genToAtto(reward);
      const closesAt = Math.floor(Date.now() / 1000) + CLOSE_OPTIONS[closeIdx].seconds;
      const challengeWindow = CHALLENGE_OPTIONS[challengeIdx].seconds;
      setPhase("signing");
      const criteriaJson = JSON.stringify(
        criteria.map((c, i) => ({
          id: (c.id || `C${i + 1}`).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24) || `C${i + 1}`,
          text: c.text.trim(),
          evidence_hint: c.hint.trim(),
        }))
      );
      const h = await write(wallet.address, "open_mission", [
        title.trim(), repo.trim(), issue.trim(), base.trim().toLowerCase(), branch.trim() || "main",
        problem.trim(), criteriaJson, scope.trim(), forbidden.trim(), evidencePolicy.trim(),
        ciRequired, closesAt, challengeWindow,
      ], value);
      setHash(h);
      setPhase("pending");
      const receipt: any = await waitFinal(h);
      setPhase("finalized");
      // Resolve the new mission id deterministically: receipt first, sponsor lookup as fallback.
      let mid = receipt?.txDataDecoded?.missionId || receipt?.data?.result || "";
      if (!(typeof mid === "string" && mid.startsWith("rv-m-"))) {
        mid = await api.findLatestBySponsor(wallet.address).catch(() => "");
      }
      if (typeof mid === "string" && mid.startsWith("rv-m-")) {
        setDoneId(mid);
        window.setTimeout(() => {
          window.location.hash = `#/missions/${mid}`;
        }, 900);
      }
    } catch (e: any) {
      setPhase("error");
      setError(friendlyError(e));
    }
  };

  if (!configured) {
    return (
      <section className="mx-auto max-w-[1220px] px-4 py-16 md:px-8">
        <EmptyState title="Deployment pending" body="The funding desk activates once a live contract address is configured for this build." />
      </section>
    );
  }

  if (!wallet.connected || !wallet.correctNetwork) {
    return (
      <section className="mx-auto max-w-[1220px] px-4 py-16 md:px-8">
        <Reveal>
          <SectionHeading
            kicker="Funding desk"
            title={<>Open a <span className="text-accent-dark">mission</span></>}
            copy="Escrow GEN against a public defect and freeze the acceptance criteria. Connect MetaMask on Studionet chain 61999 to fund a work order."
          />
          <EmptyState
            title="Wallet required"
            body="Funding escrows real GEN from your wallet. Connect MetaMask and make sure it is on the Studionet network — the connect button handles the chain switch for you."
          />
        </Reveal>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[980px] px-4 py-14 md:px-8 md:py-18">
      <Reveal>
        <SectionHeading
          kicker="Funding desk · Escrow required"
          title={<>Freeze a <span className="text-accent-dark">work order</span></>}
          copy="The plate below becomes immutable the moment your funding transaction finalizes. Write criteria someone else could verify blindly — validators will."
        />
      </Reveal>

      <Reveal delay={100}>
        <div className="plate cut">
          <div className="rail-x" />
          <div className="grid gap-6 p-6 md:p-8">
            <div>
              <label className="label">Mission title</label>
              <input className="input" placeholder="Repair multiline CSV parsing" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Repository URL</label>
                <input className="input" placeholder="https://github.com/owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
              </div>
              <div>
                <label className="label">Defect / issue URL</label>
                <input className="input" placeholder="https://github.com/owner/repo/issues/418" value={issue} onChange={(e) => setIssue(e.target.value)} />
              </div>
              <div>
                <label className="label">Frozen base commit</label>
                <input className="input" placeholder="40-character git SHA before the fix" value={base} onChange={(e) => setBase(e.target.value)} />
              </div>
              <div>
                <label className="label">Target branch</label>
                <input className="input" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Problem statement</label>
              <textarea className="input" placeholder="What breaks, who it hurts, and what a repair must demonstrably achieve." value={problem} onChange={(e) => setProblem(e.target.value)} />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <label className="label !mb-0">Acceptance criteria · frozen</label>
                <button className="chip hover:border-ink" onClick={() => criteria.length < 8 && setCriteria([...criteria, { id: `C${criteria.length + 1}`, text: "", hint: "" }])}>
                  <Plus size={12} /> Add criterion
                </button>
              </div>
              {criteria.map((c, i) => (
                <div key={i} className="grid gap-2 border border-line-soft bg-bg/50 p-3 md:grid-cols-[72px_1fr_220px_auto]">
                  <input className="input !py-2.5 text-xs font-bold uppercase" value={c.id} onChange={(e) => setCriterion(i, { id: e.target.value })} />
                  <input className="input !py-2.5 text-xs" placeholder="Verifiable requirement, e.g. quoted CRLF fields round-trip losslessly" value={c.text} onChange={(e) => setCriterion(i, { text: e.target.value })} />
                  <input className="input !py-2.5 text-xs" placeholder="Evidence hint (optional)" value={c.hint} onChange={(e) => setCriterion(i, { hint: e.target.value })} />
                  {criteria.length > 1 && (
                    <button className="chip self-start hover:border-danger hover:text-danger" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Scope policy</label>
                <textarea className="input !min-h-[96px]" placeholder="Which paths may change…" value={scope} onChange={(e) => setScope(e.target.value)} />
              </div>
              <div>
                <label className="label">Forbidden changes</label>
                <textarea className="input !min-h-[96px]" placeholder="Dependency swaps, API removals…" value={forbidden} onChange={(e) => setForbidden(e.target.value)} />
              </div>
              <div>
                <label className="label">Evidence policy</label>
                <textarea className="input !min-h-[96px]" placeholder="Which hosts and artifact forms count…" value={evidencePolicy} onChange={(e) => setEvidencePolicy(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="label">Reward · GEN</label>
                <input className="input" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} />
              </div>
              <div>
                <label className="label">Closes in</label>
                <select className="input" value={closeIdx} onChange={(e) => setCloseIdx(Number(e.target.value))}>
                  {CLOSE_OPTIONS.map((o, i) => (
                    <option key={o.label} value={i}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Challenge window</label>
                <select className="input" value={challengeIdx} onChange={(e) => setChallengeIdx(Number(e.target.value))}>
                  {CHALLENGE_OPTIONS.map((o, i) => (
                    <option key={o.label} value={i}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">CI evidence</label>
                <button
                  onClick={() => setCiRequired(!ciRequired)}
                  className={`chip w-full justify-center !py-3 ${ciRequired ? "!border-accent-dark text-accent-dark" : "text-muted"}`}
                >
                  {ciRequired ? "Required" : "Optional"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border border-line-soft bg-bg/50 px-4 py-3">
              <Banknote size={15} className="text-accent-dark" />
              <span className="micro text-muted">Derived economics</span>
              <span className="chip !py-1.5">Submission bond · {bonds.sub} GEN</span>
              <span className="chip !py-1.5">Challenge bond · {bonds.ch} GEN</span>
            </div>

            {error && <p className="flex items-center gap-2 text-sm text-danger"><ShieldAlert size={14} /> {error}</p>}
            <TxNotice
              phase={phase}
              hash={hash}
              error={phase === "error" ? error : undefined}
              done={doneId ? `Mission ${doneId} funded, frozen and recorded on-chain. Opening the work order plate…` : "Mission funded and frozen."}
            />
            {doneId && (
              <a href={`#/missions/${doneId}`} className="chip !border-accent-dark text-accent-dark hover:underline">
                Open the work order plate now <ArrowUpRight size={12} />
              </a>
            )}
            <button className="btn btn-accent w-full !py-4" onClick={submit} disabled={phase === "signing" || phase === "pending"}>
              {phase === "signing" || phase === "pending" ? <Loader2 size={16} className="spin" /> : <Banknote size={16} />}
              Fund work order · {reward || "0"} GEN escrow
            </button>
            <p className="micro leading-relaxed text-muted">
              Escrow is refundable only by expiry or by cancellation before any candidate arrives. After that, settlement follows the frozen spec.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
