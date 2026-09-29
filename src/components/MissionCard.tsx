import { ArrowUpRight, Layers, Timer } from "lucide-react";
import type { Mission } from "../lib/genlayer";
import { attoToGen, countdown, MISSION_STATUS, repoName } from "../lib/format";
import { Pill } from "./ui";

export function MissionCard({ mission, compact = false }: { mission: Mission; compact?: boolean }) {
  const meta = MISSION_STATUS[mission.status] || { label: mission.status, tone: "off" as const, blurb: "" };
  const reward = (() => {
    try {
      return (BigInt(mission.reward_atto || "0") + BigInt(mission.bonus_atto || "0")).toString();
    } catch {
      return "0";
    }
  })();
  return (
    <a
      href={`#/missions/${mission.id}`}
      className="plate cut group flex flex-col gap-4 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_#07110e66]"
    >
      <div className="flex items-center justify-between gap-3">
        <Pill tone={meta.tone}>{meta.label}</Pill>
        <span className="mono-num text-right">
          <span className="display text-xl font-extrabold text-accent-dark">{attoToGen(reward)}</span>
          <span className="micro ml-1.5 text-muted">GEN</span>
        </span>
      </div>
      <div>
        <h3 className="display text-[19px] font-bold leading-tight group-hover:text-accent-dark transition-colors">
          {mission.title}
        </h3>
        <p className="micro mt-2 flex items-center gap-1.5 text-muted">
          <Layers size={12} />
          {repoName(mission.repository_url)}
        </p>
      </div>
      <div className="hairline-dash" />
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5 font-semibold">
          <Timer size={13} />
          {mission.status === "OPEN" ? countdown(mission.closes_at) : meta.label}
        </span>
        <span className="micro">
          {mission.submission_count} candidate{Number(mission.submission_count) === 1 ? "" : "s"}
        </span>
        {!compact && (
          <span className="grid h-7 w-7 place-items-center border border-line transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-[#f8fcf9]">
            <ArrowUpRight size={14} />
          </span>
        )}
      </div>
    </a>
  );
}
