import { ReactNode, useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import { avatarFor, dotClass, shortHash, Tone } from "../lib/format";
import { EXPLORER_URL } from "../config/network";
import { cn } from "../utils/cn";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setInView(true)),
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", inView && "is-in", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={cn("micro flex items-center gap-2", dark ? "text-[#9fb5ad]" : "text-muted")}>
      <span className="inline-block h-px w-8 bg-current opacity-60" />
      {children}
    </p>
  );
}

export function SectionHeading({ kicker, title, copy, dark = false }: { kicker: string; title: ReactNode; copy?: string; dark?: boolean }) {
  return (
    <div className="mb-10 max-w-2xl">
      <Kicker dark={dark}>{kicker}</Kicker>
      <h2 className={cn("display mt-3 text-4xl font-bold leading-[1.02] md:text-5xl", dark && "text-[#f8fcf9]")}>{title}</h2>
      {copy && <p className={cn("mt-4 text-[15px] leading-relaxed", dark ? "text-[#9fb5ad]" : "text-muted")}>{copy}</p>}
    </div>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  return <span className={dotClass[tone]} />;
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("chip", className)}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

export function Avatar({ seed, size = 44 }: { seed: string; size?: number }) {
  const { bg, fg, initials } = avatarFor(seed);
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.3 }} aria-hidden>
      {initials}
    </span>
  );
}

export function AddressChip({ address, className }: { address?: string; className?: string }) {
  if (!address) return <span className="micro text-muted">—</span>;
  return (
    <a
      href={`${EXPLORER_URL}/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className={cn("chip hover:border-ink transition-colors", className)}
    >
      <Dot tone="info" />
      {shortHash(address, 8, 6)}
    </a>
  );
}

export function KeyValue({ k, v, dark = false }: { k: string; v: ReactNode; dark?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <span className={cn("micro pt-0.5", dark ? "text-[#9fb5ad]" : "text-muted")}>{k}</span>
      <span className={cn("text-right text-sm font-semibold leading-snug", dark && "text-[#f8fcf9]")}>{v}</span>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="plate cut flex flex-col items-center gap-4 px-8 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center border border-line text-muted">
        <CircleSlash size={20} strokeWidth={1.6} />
      </span>
      <div>
        <p className="display text-xl font-bold">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="plate cut p-6">
          <div className="shimmer h-4 w-1/3" />
          <div className="shimmer mt-4 h-3 w-2/3" />
          <div className="shimmer mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export type TxPhase = "idle" | "signing" | "pending" | "finalized" | "error";

export function TxNotice({ phase, hash, error, done }: { phase: TxPhase; hash?: string; error?: string; done?: string }) {
  if (phase === "idle") return null;
  const base = "flex items-start gap-3 border px-4 py-3 text-sm";
  if (phase === "signing") {
    return (
      <div className={cn(base, "border-line bg-paper")}>
        <Loader2 size={16} className="spin mt-0.5 text-accent-dark" />
        <span>Confirm the request in MetaMask on Studionet.</span>
      </div>
    );
  }
  if (phase === "pending") {
    return (
      <div className={cn(base, "border-line bg-paper")}>
        <Loader2 size={16} className="spin mt-0.5 text-accent-dark" />
        <span>
          Transaction submitted{hash ? ` · ${shortHash(hash, 10, 8)}` : ""}. Waiting for validator consensus and finalization — this can take a couple of minutes.
        </span>
      </div>
    );
  }
  if (phase === "finalized") {
    return (
      <div className={cn(base, "border-accent-dark/40 bg-accent-soft text-accent-dark")}>
        <CheckCircle2 size={16} className="mt-0.5" />
        <span>{done || "Finalized on Studionet."}</span>
      </div>
    );
  }
  return (
    <div className={cn(base, "border-danger/40 bg-[#f9e9e3] text-danger")}>
      <AlertTriangle size={16} className="mt-0.5" />
      <span>{error || "The transaction reverted."}</span>
    </div>
  );
}

export function BondMeter({ label, atto, total }: { label: string; atto: string; total: string }) {
  let pct = 0;
  try {
    const t = BigInt(total || "0");
    pct = t > 0n ? Math.min(100, Number((BigInt(atto || "0") * 10000n) / t) / 100) : 0;
  } catch {
    pct = 0;
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="micro text-muted">{label}</span>
        <span className="mono-num text-xs font-bold">{pct.toFixed(1)}%</span>
      </div>
      <div className="meter">
        <span style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}
