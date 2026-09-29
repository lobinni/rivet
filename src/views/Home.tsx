import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BadgeCheck, FileLock2, Gavel, HandCoins, ScanSearch } from "lucide-react";
import { api, Mission } from "../lib/genlayer";
import { isConfigured } from "../config/network";
import { attoToGen } from "../lib/format";
import { ACTIVITY, MONEY_ROWS, PROTOCOL_STEPS } from "../data/content";
import { Avatar, Dot, EmptyState, Reveal, SectionHeading, SkeletonRows } from "../components/ui";
import { Ticker } from "../components/Shell";
import { MissionCard } from "../components/MissionCard";

function HeroStats() {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    if (!isConfigured()) return;
    let alive = true;
    api.getStats().then((s) => alive && setStats(s)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const items = [
    { dot: "live" as const, label: "Missions opened", value: stats ? String(stats.missions) : "—" },
    { dot: "info" as const, label: "Candidates sealed", value: stats ? String(stats.submissions) : "—" },
    { dot: "warn" as const, label: "GEN in escrow", value: stats ? attoToGen(String(stats.reward_escrow_atto || 0)) : "—" },
  ];
  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((x) => (
        <span key={x.label} className="chip !py-2.5 !px-4">
          <Dot tone={x.dot} />
          <span className="mono-num text-sm font-extrabold tracking-normal text-ink">{x.value}</span>
          <span className="text-muted">{x.label}</span>
        </span>
      ))}
    </div>
  );
}

function ActivityFeed() {
  return (
    <div className="relative h-[420px] select-none" aria-label="Live protocol activity">
      <div className="plate cut absolute left-0 top-6 w-[86%] p-4 float-slow">
        <div className="flex items-center gap-3">
          <Avatar seed={ACTIVITY[0].name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{ACTIVITY[0].name}</p>
            <p className="micro mt-0.5 truncate text-muted">{ACTIVITY[0].action}</p>
          </div>
          <span className="chip ml-auto !py-1.5">{ACTIVITY[0].delta}</span>
        </div>
      </div>
      <div className="plate cut absolute right-0 top-[108px] w-[78%] p-4 float-slower">
        <div className="flex items-center gap-3">
          <Avatar seed={ACTIVITY[1].name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{ACTIVITY[1].name}</p>
            <p className="micro mt-0.5 truncate text-muted">{ACTIVITY[1].action}</p>
          </div>
          <span className="chip ml-auto !py-1.5">{ACTIVITY[1].delta}</span>
        </div>
      </div>
      <div className="plate cut absolute left-[8%] top-[196px] w-[80%] p-4 float-slow" style={{ animationDelay: "-3s" }}>
        <div className="flex items-center gap-3">
          <Avatar seed={ACTIVITY[4].name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{ACTIVITY[4].name}</p>
            <p className="micro mt-0.5 truncate text-muted">{ACTIVITY[4].action}</p>
          </div>
          <span className="chip ml-auto !py-1.5">{ACTIVITY[4].delta}</span>
        </div>
      </div>
      <div className="plate-dark cut absolute bottom-4 right-[6%] w-[84%] p-4 float-slower" style={{ animationDelay: "-5s" }}>
        <div className="flex items-center gap-3">
          <Avatar seed={ACTIVITY[5].name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#f8fcf9]">{ACTIVITY[5].name}</p>
            <p className="micro mt-0.5 truncate text-[#9fb5ad]">{ACTIVITY[5].action}</p>
          </div>
          <span className="chip ml-auto !border-[#f8fcf92b] !bg-transparent !py-1.5 text-accent">{ACTIVITY[5].delta}</span>
        </div>
      </div>
      <div className="micro absolute -bottom-2 left-1 flex items-center gap-2 text-muted">
        <span className="dot dot-live" /> Live work order flow · Consensus rounds
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1220px] gap-12 px-4 pb-16 pt-14 md:grid-cols-[1.15fr_1fr] md:px-8 md:pb-24 md:pt-20">
        <div>
          <Reveal>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip">
                <Dot tone="live" /> GenLayer Studionet · Chain 61999
              </span>
              <span className="chip">Funded work orders</span>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="display mt-7 text-[13.5vw] font-extrabold leading-[0.94] tracking-tight sm:text-6xl md:text-[74px]">
              Repairs that
              <br />
              pay on <span className="text-accent-dark">proof</span>
              <span className="text-accent">.</span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted">
              Sponsors freeze acceptance criteria and escrow GEN. Contributors commit exact patches with public evidence.
              Validators re-fetch the evidence and judge every criterion — twice, independently. The first patch that survives the
              bonded challenge window takes the pot.
            </p>
          </Reveal>
          <Reveal delay={260}>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#/missions" className="btn btn-accent">
                Browse missions <ArrowRight size={16} />
              </a>
              <a href="#/open" className="btn btn-ghost">
                Fund a work order <ArrowUpRight size={16} />
              </a>
            </div>
          </Reveal>
          <Reveal delay={340}>
            <div className="mt-9">
              <HeroStats />
            </div>
          </Reveal>
        </div>
        <Reveal delay={220} className="hidden md:block">
          <ActivityFeed />
        </Reveal>
      </div>
      <Ticker dark={false} />
    </section>
  );
}

function LatestMissions() {
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const configured = isConfigured();
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    api
      .listMissions(0, 6)
      .then((res) => alive && setMissions(res.items || []))
      .catch(() => alive && setMissions([]));
    return () => {
      alive = false;
    };
  }, [configured]);
  return (
    <section className="mx-auto max-w-[1220px] px-4 py-16 md:px-8 md:py-24">
      <Reveal>
        <SectionHeading
          kicker="Market board"
          title={
            <>
              Live <span className="text-accent-dark">work orders</span>
            </>
          }
          copy="Every mission below is escrowed on-chain. Criteria are frozen, the clock is public, and settlement is reproducible from the deployed source."
        />
      </Reveal>
      {!configured ? (
        <Reveal delay={120}>
          <EmptyState
            title="Deployment pending"
            body="The release contract address is not configured yet. Once the Studionet deployment lands and the address is recorded, live work orders appear here automatically."
            action={
              <a href="#/open" className="btn btn-sm btn-ghost">
                Read the launch flow <ArrowRight size={14} />
              </a>
            }
          />
        </Reveal>
      ) : missions === null ? (
        <SkeletonRows rows={3} />
      ) : missions.length === 0 ? (
        <Reveal delay={120}>
          <EmptyState
            title="No missions yet"
            body="The market is live but no work order has been funded. Escrow GEN against a public issue to open the first one."
            action={
              <a href="#/open" className="btn btn-sm btn-accent">
                Open the first mission <ArrowRight size={14} />
              </a>
            }
          />
        </Reveal>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((m, i) => (
            <Reveal key={m.id} delay={i * 70}>
              <MissionCard mission={m} />
            </Reveal>
          ))}
        </div>
      )}
      {configured && missions && missions.length > 0 && (
        <Reveal delay={200}>
          <div className="mt-8 text-center">
            <a href="#/missions" className="btn btn-ghost btn-sm">
              Full market board <ArrowRight size={14} />
            </a>
          </div>
        </Reveal>
      )}
    </section>
  );
}

const STEP_ICONS = [FileLock2, ScanSearch, BadgeCheck, Gavel, HandCoins];

function ProtocolStrip() {
  return (
    <section className="border-y border-line bg-paper">
      <div className="mx-auto max-w-[1220px] px-4 py-16 md:px-8 md:py-24">
        <Reveal>
          <SectionHeading
            kicker="How settlement works"
            title={
              <>
                Five moves, <span className="text-accent-dark">zero trust</span>
              </>
            }
            copy="Semantic judgment decides what is true; deterministic code decides who is paid. The two never mix."
          />
        </Reveal>
        <div className="grid gap-4 md:grid-cols-5">
          {PROTOCOL_STEPS.map((step, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <Reveal key={step.index} delay={i * 80}>
                <div className="plate cut group flex h-full flex-col gap-4 p-5 transition-colors hover:bg-accent-soft/40">
                  <div className="flex items-center justify-between">
                    <span className="micro text-muted">{step.index}</span>
                    <span className="grid h-9 w-9 place-items-center border border-line bg-paper text-accent-dark transition-colors group-hover:border-accent-dark">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                  </div>
                  <h3 className="display text-[17px] font-bold leading-tight">{step.title}</h3>
                  <p className="text-[13px] leading-relaxed text-muted">{step.body}</p>
                  <span className="micro mt-auto pt-2 text-accent-dark">{step.meta}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MoneyModel() {
  return (
    <section className="mx-auto max-w-[1220px] px-4 py-16 md:px-8 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <SectionHeading
            kicker="Escrow economics"
            title={
              <>
                Bonds keep the <span className="text-accent-dark">field honest</span>
              </>
            }
            copy="Every actor posts skin before they speak. The accounting invariant is exposed on-chain after every transition — deposits always equal escrow plus credit plus withdrawals."
          />
          <a href="#/protocol" className="btn btn-ghost btn-sm">
            Full settlement boundary <ArrowRight size={14} />
          </a>
        </Reveal>
        <div className="flex flex-col gap-3">
          {MONEY_ROWS.map((row, i) => (
            <Reveal key={row.label} delay={i * 60}>
              <div className="plate cut-sm flex flex-col gap-1.5 p-5 sm:flex-row sm:items-center sm:gap-6">
                <span className="micro w-44 flex-none text-ink">{row.label}</span>
                <span className="hairline-dash hidden flex-none sm:block sm:w-10" />
                <span className="text-[13.5px] leading-relaxed text-muted">{row.value}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="px-4 pb-20 md:px-8">
      <Reveal>
        <div className="plate-dark cut relative mx-auto max-w-[1220px] overflow-hidden px-6 py-14 text-center md:py-20">
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(700px 260px at 50% 120%, #087f7144, transparent 70%)" }} />
          <p className="micro text-[#9fb5ad]">GenLayer Studionet · Chain 61999</p>
          <h2 className="display mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-[1.02] text-[#f8fcf9] md:text-5xl">
            Ship the fix. Survive the window. <span className="text-accent">Take the pot.</span>
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#/missions" className="btn btn-accent">
              Enter the market <ArrowRight size={16} />
            </a>
            <a href="#/protocol" className="btn border-[#f8fcf92b] bg-transparent text-[#f8fcf9] hover:border-accent">
              Read the protocol
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <LatestMissions />
      <ProtocolStrip />
      <MoneyModel />
      <CtaBand />
    </>
  );
}
