import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, HandCoins, Info, KeyRound, Loader2, PackageOpen, RefreshCcw, XCircle } from "lucide-react";
import { api, friendlyError, waitFinal, write } from "../lib/genlayer";
import { isConfigured } from "../config/network";
import { useWallet } from "../lib/wallet-context";
import { dropPayload, payloadsFor, RevealPayload } from "../lib/reveal";
import { attoToGen, prettyTime, shortSha } from "../lib/format";
import { EmptyState, KeyValue, Reveal, SectionHeading, TxNotice, TxPhase } from "../components/ui";

function CreditCard() {
  const wallet = useWallet();
  const [credit, setCredit] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<string | undefined>();
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!wallet.address || !isConfigured()) return;
    api.getCredit(wallet.address).then(setCredit).catch(() => setCredit("0"));
  }, [wallet.address]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  const withdraw = async () => {
    if (!wallet.address) return;
    setError("");
    try {
      setPhase("signing");
      const h = await write(wallet.address, "withdraw_credit", [wallet.address], 0n);
      setHash(h);
      setPhase("pending");
      await waitFinal(h);
      setPhase("finalized");
      load();
    } catch (e: any) {
      setPhase("error");
      setError(friendlyError(e));
    }
  };

  const hasCredit = credit !== null && credit !== "0";
  return (
    <div className="plate cut p-6 md:p-8">
      <div className="flex items-center justify-between">
        <p className="micro text-muted">On-chain credit · pull payments</p>
        <button className="chip hover:border-ink" onClick={load} title="Refresh">
          <RefreshCcw size={12} />
        </button>
      </div>
      <p className="display mt-5 text-5xl font-extrabold text-accent-dark">
        {credit === null ? <Loader2 size={30} className="spin" /> : attoToGen(credit)} <span className="text-lg text-muted">GEN</span>
      </p>
      <div className="hairline-dash my-6" />
      <KeyValue k="Model" v="Winner rewards, refunded bonds and challenge payouts accrue as credit" />
      <KeyValue k="Release" v="Only your signature can move it" />
      <div className="mt-4 grid gap-2.5">
        <TxNotice phase={phase} hash={hash} error={phase === "error" ? error : undefined} done="Credit withdrawn to your wallet." />
        <button className="btn btn-accent w-full" onClick={withdraw} disabled={!hasCredit || phase === "signing" || phase === "pending"}>
          <HandCoins size={16} /> Withdraw credit
        </button>
      </div>
    </div>
  );
}

function PayloadRow({ payload, onDrop }: { payload: RevealPayload; onDrop: () => void }) {
  return (
    <div className="plate cut-sm flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="chip !border-warn text-[#8d5132]">
          <KeyRound size={12} /> Sealed · awaiting reveal
        </span>
        <a href={`#/missions/${payload.missionId}`} className="chip hover:border-ink transition-colors">
          {payload.missionId} <ArrowUpRight size={11} />
        </a>
        <button className="chip ml-auto hover:border-danger hover:text-danger" onClick={onDrop} title="Forget payload">
          <XCircle size={12} />
        </button>
      </div>
      <div className="grid gap-1.5 text-xs text-muted sm:grid-cols-2">
        <span>Candidate {shortSha(payload.candidateCommit)}</span>
        <span>Stored {prettyTime(payload.storedAt)}</span>
        {payload.submissionId ? <span>Submission {payload.submissionId}</span> : <span>Submission id resolves after commit finalizes</span>}
      </div>
      <p className="flex items-start gap-2 border-t border-line-soft pt-3 text-xs leading-relaxed text-muted">
        <Info size={13} className="mt-0.5 flex-none text-accent-dark" />
        Open the mission plate and press reveal before the 30-minute window closes. This payload never leaves your browser.
      </p>
    </div>
  );
}

function Payloads() {
  const wallet = useWallet();
  const [, setTick] = useState(0);
  const items = payloadsFor(wallet.address);
  return (
    <div className="plate cut p-6 md:p-8">
      <div className="flex items-center justify-between">
        <p className="micro text-muted">Reveal recovery · this browser</p>
        <span className="chip !py-1.5">{items.length} stored</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          <span className="grid h-11 w-11 place-items-center border border-line text-muted">
            <PackageOpen size={18} strokeWidth={1.6} />
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            When you seal a candidate, the salt and evidence bundle appear here so a closed tab never costs your bond.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {items.map((p) => (
            <PayloadRow
              key={`${p.missionId}-${p.salt.slice(0, 8)}`}
              payload={p}
              onDrop={() => {
                dropPayload(p.submissionId || p.missionId);
                setTick((n) => n + 1);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Workbench() {
  const wallet = useWallet();
  const configured = isConfigured();

  if (!configured) {
    return (
      <section className="mx-auto max-w-[1220px] px-4 py-16 md:px-8">
        <EmptyState title="Deployment pending" body="The bench reads live credit and submissions once a contract address is configured." />
      </section>
    );
  }

  if (!wallet.connected || !wallet.correctNetwork) {
    return (
      <section className="mx-auto max-w-[1220px] px-4 py-16 md:px-8">
        <SectionHeading
          kicker="Contributor bench"
          title={<>Your <span className="text-accent-dark">workbench</span></>}
          copy="Reveal recovery and on-chain credit live here. Connect MetaMask on Studionet chain 61999 to open the bench."
        />
        <EmptyState title="Wallet required" body="Only your wallet can reveal your candidates and withdraw your credit." />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[980px] px-4 py-14 md:px-8">
      <Reveal>
        <SectionHeading
          kicker={`Contributor bench · ${wallet.address?.slice(0, 6)}…${wallet.address?.slice(-4)}`}
          title={<>The <span className="text-accent-dark">bench</span></>}
          copy="Two things live here: the reveal payloads your browser is holding, and the credit the contract owes you."
        />
      </Reveal>
      <div className="grid gap-5">
        <Reveal delay={80}>
          <CreditCard />
        </Reveal>
        <Reveal delay={140}>
          <Payloads />
        </Reveal>
      </div>
    </section>
  );
}
