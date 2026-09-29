import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { api, Mission } from "../lib/genlayer";
import { isConfigured } from "../config/network";
import { EmptyState, Reveal, SectionHeading, SkeletonRows } from "../components/ui";
import { MissionCard } from "../components/MissionCard";
import { cn } from "../utils/cn";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "QUALIFIED_PENDING", label: "Challenge window" },
  { key: "CLOSED", label: "Settled" },
  { key: "ARCHIVE", label: "Archive" },
];

export default function Missions() {
  const configured = isConfigured();
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const load = () =>
      api
        .listMissions(0, 24)
        .then((res) => alive && setMissions(res.items || []))
        .catch(() => alive && setMissions([]));
    load();
    const timer = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [configured]);

  const filtered = useMemo(() => {
    if (!missions) return [];
    const q = query.trim().toLowerCase();
    return missions
      .filter((m) => {
        if (filter === "ALL") return true;
        if (filter === "ARCHIVE") return m.status === "EXPIRED" || m.status === "CANCELLED";
        return m.status === filter;
      })
      .filter((m) => !q || m.title.toLowerCase().includes(q) || m.repository_url.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .reverse();
  }, [missions, query, filter]);

  return (
    <section className="mx-auto max-w-[1220px] px-4 py-14 md:px-8 md:py-20">
      <Reveal>
        <SectionHeading
          kicker="Market board · On-chain"
          title={
            <>
              Mission <span className="text-accent-dark">hub</span>
            </>
          }
          copy="Every funded work order on Studionet, read straight from finalized state. Pick a plate, seal a candidate, and let consensus do the judging."
        />
      </Reveal>

      {!configured ? (
        <EmptyState
          title="Deployment pending"
          body="No contract address is configured for this build yet. The board hydrates itself as soon as deployments/studionet.json (or VITE_RIVET_CONTRACT) carries a live address."
          action={
            <a href="#/protocol" className="btn btn-sm btn-ghost">
              How the market works <ArrowRight size={14} />
            </a>
          }
        />
      ) : (
        <>
          <Reveal delay={80}>
            <div className="plate mb-8 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, repository, or mission id…"
                  className="input !border-transparent !bg-transparent !pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn("micro border px-3 py-2.5 transition-colors", filter === f.key ? "border-ink bg-ink text-[#f8fcf9]" : "border-line text-muted hover:text-ink")}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
          {missions === null ? (
            <SkeletonRows rows={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={missions.length === 0 ? "No missions yet" : "Nothing matches"}
              body={
                missions.length === 0
                  ? "The contract is live but the board is empty. Fund the first work order and freeze the criteria."
                  : "Try a different search or filter."
              }
              action={
                <a href="#/open" className="btn btn-sm btn-accent">
                  Fund a mission <ArrowRight size={14} />
                </a>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m, i) => (
                <Reveal key={m.id} delay={Math.min(i, 6) * 60}>
                  <MissionCard mission={m} />
                </Reveal>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
