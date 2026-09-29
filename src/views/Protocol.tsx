import { useState } from "react";
import { ArrowRight, FileSearch, Landmark, Minus, Plus, Scale, ShieldCheck, Webhook } from "lucide-react";
import { EVIDENCE_KINDS, FAQ, MONEY_ROWS, PROTOCOL_STEPS } from "../data/content";
import { Kicker, Reveal, SectionHeading } from "../components/ui";
import { Ticker } from "../components/Shell";
import { cn } from "../utils/cn";

function ThreeQuestions() {
  const cards = [
    {
      icon: FileSearch,
      title: "Is it the claimed artifact?",
      body: "Validators re-fetch the bundle and establish that the repository, exact candidate SHA, diff and CI all describe the same patch — ready to judge, still cooking, or flatly wrong.",
      tag: "Artifact examination",
    },
    {
      icon: Scale,
      title: "Does it satisfy the frozen spec?",
      body: "Every criterion gets its own verdict: satisfied, failed, or not proven. The overall outcome is the mechanical roll-up of those rows — never a free-form opinion.",
      tag: "Criterion review",
    },
    {
      icon: Webhook,
      title: "Can new evidence defeat it?",
      body: "A bonded challenger names one frozen criterion and posts fresh public evidence. Consensus decides whether it materially breaks qualification.",
      tag: "Bonded challenge",
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c, i) => (
        <Reveal key={c.title} delay={i * 80}>
          <div className="plate cut flex h-full flex-col gap-4 p-6">
            <span className="grid h-10 w-10 place-items-center border border-line bg-bg text-accent-dark">
              <c.icon size={18} strokeWidth={1.7} />
            </span>
            <h3 className="display text-lg font-bold leading-tight">{c.title}</h3>
            <p className="text-[13.5px] leading-relaxed text-muted">{c.body}</p>
            <span className="micro mt-auto pt-2 text-accent-dark">{c.tag}</span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function RollupPlate() {
  return (
    <div className="plate-dark cut p-6 md:p-8">
      <Kicker dark>Mechanical roll-up</Kicker>
      <h3 className="display mt-3 text-2xl font-bold text-[#f8fcf9]">The verdict is arithmetic, not taste</h3>
      <div className="mt-6 grid gap-2.5">
        {[
          { when: "Any criterion failed, scope broken, forbidden change, or required CI failed", then: "Rejected — bond to sponsor", tone: "text-[#f0a74b]" },
          { when: "Otherwise, any criterion not proven", then: "Inconclusive — bond refunded", tone: "text-[#9fb5ad]" },
          { when: "Every criterion satisfied, no violations", then: "Qualified — challenge window opens", tone: "text-accent" },
        ].map((row) => (
          <div key={row.then} className="grid gap-1 border border-[#f8fcf917] bg-[#ffffff08] p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
            <span className="text-[13.5px] leading-relaxed text-[#cfeee5]">{row.when}</span>
            <span className={cn("micro whitespace-nowrap", row.tone)}>{row.then}</span>
          </div>
        ))}
      </div>
      <p className="micro mt-5 flex items-center gap-2 text-[11px] text-[#9fb5ad]">
        <ShieldCheck size={13} className="text-accent" /> An answer that violates the roll-up is rejected by every validator, consensus or not
      </p>
    </div>
  );
}

function EvidenceGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {EVIDENCE_KINDS.map((e, i) => (
        <Reveal key={e.kind} delay={i * 60}>
          <div className="plate cut-sm flex h-full flex-col gap-2 p-5">
            <div className="flex items-center justify-between">
              <span className="micro font-bold text-ink">{e.kind}</span>
              <span className={cn("micro !text-[10px]", e.required === true ? "text-accent-dark" : e.required ? "text-[#936800]" : "text-muted")}>
                {e.required === true ? "Mandatory" : e.required || "Optional"}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">{e.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function MoneyTable() {
  return (
    <div className="plate cut">
      <div className="rail-x" />
      <div className="divide-y divide-line-soft">
        {MONEY_ROWS.map((row) => (
          <div key={row.label} className="grid gap-1.5 px-6 py-5 sm:grid-cols-[220px_1fr] sm:gap-6">
            <span className="micro flex items-center gap-2 text-ink">
              <Landmark size={13} className="text-accent-dark" /> {row.label}
            </span>
            <span className="text-[13.5px] leading-relaxed text-muted">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-line border-y border-line">
      {FAQ.map((f, i) => (
        <div key={f.q}>
          <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
            <span className="display text-[17px] font-bold">{f.q}</span>
            <span className="grid h-7 w-7 flex-none place-items-center border border-line bg-paper">
              {open === i ? <Minus size={14} /> : <Plus size={14} />}
            </span>
          </button>
          {open === i && <p className="max-w-3xl pb-6 text-[14px] leading-relaxed text-muted">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}

export default function Protocol() {
  return (
    <>
      <section className="mx-auto max-w-[1220px] px-4 py-14 md:px-8 md:py-20">
        <Reveal>
          <SectionHeading
            kicker="Protocol · Trust model"
            title={
              <>
                The settlement <span className="text-accent-dark">boundary</span>
              </>
            }
            copy="Rivet answers three narrow questions with independent consensus, then lets deterministic code move the money. This page is the whole model — there is no hidden layer."
          />
        </Reveal>
        <ThreeQuestions />
      </section>

      <section className="mx-auto max-w-[1220px] px-4 pb-16 md:px-8 md:pb-20">
        <Reveal>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
            <div className="plate cut flex flex-col gap-4 p-6 md:p-8">
              <Kicker>Why validators</Kicker>
              <h3 className="display text-2xl font-bold leading-tight">Judgment is reproduced, not trusted</h3>
              <p className="text-[14px] leading-relaxed text-muted">
                A sponsor could favor a friend. A contributor could self-certify. A hosted AI could be bribed once. Rivet removes all three: every validator
                fetches the same public evidence and answers the same structured question, and answers must agree field-by-field.
              </p>
              <div className="mt-auto grid gap-2 pt-3">
                {PROTOCOL_STEPS.map((s) => (
                  <div key={s.index} className="flex items-center gap-3 border border-line-soft bg-bg/60 px-4 py-2.5">
                    <span className="micro text-accent-dark">{s.index}</span>
                    <span className="text-[13px] font-semibold">{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <RollupPlate />
          </div>
        </Reveal>
      </section>

      <Ticker dark />

      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-[1220px] px-4 py-16 md:px-8 md:py-20">
          <Reveal>
            <SectionHeading
              kicker="Evidence bundle"
              title={<>What validators <span className="text-accent-dark">fetch</span></>}
              copy="Two to six public HTTPS sources per candidate. Commit and diff are always mandatory; CI is mandatory when the sponsor froze it in."
            />
          </Reveal>
          <EvidenceGrid />
        </div>
      </section>

      <section className="mx-auto max-w-[1220px] px-4 py-16 md:px-8 md:py-20">
        <Reveal>
          <SectionHeading
            kicker="Escrow economics"
            title={<>Where every <span className="text-accent-dark">atto sits</span></>}
            copy="Deposits always equal escrow plus claimable credit plus withdrawals — an invariant the contract exposes publicly after every transition."
          />
        </Reveal>
        <Reveal delay={100}>
          <MoneyTable />
        </Reveal>
      </section>

      <section className="mx-auto max-w-[900px] px-4 pb-16 md:px-8 md:pb-20">
        <Reveal>
          <SectionHeading
            kicker="Questions"
            title={<>Honest <span className="text-accent-dark">answers</span></>}
          />
          <Faq />
          <div className="plate mt-10 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-[13.5px] leading-relaxed text-muted">
              Consensus judges public evidence; it does not create objective truth. Frozen criteria, exact SHA binding, fail-closed states and the challenge window reduce that gap — they do not erase it.
            </p>
            <a href="#/missions" className="btn btn-sm btn-accent whitespace-nowrap">
              See it live <ArrowRight size={14} />
            </a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
