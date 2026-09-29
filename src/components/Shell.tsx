import { useEffect, useState } from "react";
import { Menu, X, Wallet, Unplug, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useWallet } from "../lib/wallet-context";
import { shortHash } from "../lib/format";
import { CHAIN_ID, DEPLOYMENT_STATUS, EXPLORER_URL, isConfigured, CONTRACT_ADDRESS } from "../config/network";
import { TICKER_ITEMS } from "../data/content";
import { cn } from "../utils/cn";

export function RivetMark({ size = 30, invert = false }: { size?: number; invert?: boolean }) {
  const ring = invert ? "#35d5b4" : "#087f71";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" fill={invert ? "#f8fcf9" : "#07110e"} />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke={ring} strokeWidth="2.4" />
      <circle cx="16" cy="16" r="3" fill={ring} />
      <path d="M16 4v4M16 24v4M4 16h4M24 16h4" stroke={invert ? "#f8fcf9" : "#07110e"} strokeWidth="1.6" />
    </svg>
  );
}

const NAV = [
  { to: "#/missions", label: "Missions" },
  { to: "#/open", label: "Open mission" },
  { to: "#/workbench", label: "Workbench" },
  { to: "#/certificates", label: "Certificates" },
  { to: "#/protocol", label: "Protocol" },
];

export function WalletButton() {
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onConnect = async () => {
    setBusy(true);
    setError("");
    try {
      await wallet.connect();
    } catch (e: any) {
      setError(e?.message || "Connection rejected");
      setTimeout(() => setError(""), 5000);
    } finally {
      setBusy(false);
    }
  };

  if (!wallet.hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="btn btn-sm"
      >
        <Wallet size={15} /> Install MetaMask
      </a>
    );
  }

  if (wallet.connected) {
    return (
      <div className="flex items-center gap-2">
        {!wallet.correctNetwork && (
          <button onClick={() => wallet.switchNetwork().catch(() => undefined)} className="chip !border-warn text-[#8d5132]">
            <span className="dot dot-warn" /> Switch to 61999
          </button>
        )}
        <span className="chip">
          <span className={wallet.correctNetwork ? "dot dot-live" : "dot dot-warn"} />
          {shortHash(wallet.address || "", 8, 6)}
        </span>
        <button onClick={wallet.disconnect} title="Disconnect session" className="chip hover:border-ink transition-colors">
          <Unplug size={13} />
        </button>
        {error && <span className="micro absolute right-4 top-16 bg-paper px-3 py-2 text-danger border border-line">{error}</span>}
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={onConnect} disabled={busy || !wallet.ready} className="btn btn-sm btn-accent">
        <Wallet size={15} />
        {busy ? "Connecting…" : "Connect wallet"}
      </button>
      {error && <span className="micro absolute -bottom-9 right-0 whitespace-nowrap border border-line bg-paper px-3 py-1.5 text-danger normal-case tracking-normal">{error}</span>}
    </div>
  );
}

export function Header({ route }: { route: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1220px] items-center justify-between gap-4 px-4 md:px-8">
        <a href="#/" className="flex items-center gap-3">
          <RivetMark />
          <span className="leading-none">
            <span className="display block text-[19px] font-extrabold tracking-tight">RIVET</span>
            <span className="micro mt-1 block text-[9px] text-muted">Repair market · Studionet</span>
          </span>
        </a>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = route.startsWith(item.to.slice(1)) || (item.to === "#/missions" && route.startsWith("/missions"));
            return (
              <a
                key={item.to}
                href={item.to}
                className={cn(
                  "micro px-3.5 py-2 transition-colors border border-transparent",
                  active ? "bg-ink text-[#f8fcf9]" : "text-muted hover:text-ink hover:border-line"
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className="chip hidden md:inline-flex">
            <span className="dot dot-live" />
            Studionet · {CHAIN_ID}
          </span>
          <WalletButton />
          <button className="chip lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-paper px-4 py-3 lg:hidden">
          {NAV.map((item) => (
            <a key={item.to} href={item.to} className="micro block border-b border-line-soft px-2 py-3 last:border-0 hover:text-accent-dark">
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Ticker({ dark = true }: { dark?: boolean }) {
  const row = (
    <div className="flex items-center gap-8 pr-8">
      {TICKER_ITEMS.map((item, i) => (
        <span key={i} className="micro flex items-center gap-8 whitespace-nowrap">
          <span className={cn("h-1 w-1 rotate-45", dark ? "bg-accent" : "bg-accent-dark")} />
          {item}
        </span>
      ))}
    </div>
  );
  return (
    <div className={cn("ticker border-y py-3", dark ? "border-[#f8fcf92b] bg-night text-[#cfeee5]" : "border-line bg-paper text-muted")}>
      <div className="ticker-track">
        {row}
        {row}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="plate-dark cut-none border-t border-[#f8fcf92b]">
      <div className="mx-auto max-w-[1220px] px-4 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <RivetMark invert />
              <span className="display text-2xl font-extrabold text-[#f8fcf9]">RIVET</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#9fb5ad]">
              Funded public-software repair missions, settled by validator consensus against exact patches and frozen criteria.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["No admin keys", "No proxy", "Pull payments"].map((s) => (
                <span key={s} className="micro border border-[#f8fcf92b] px-2.5 py-1.5 text-[10px] text-[#cfeee5]">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="micro mb-4 text-[#9fb5ad]">Market</p>
            {NAV.slice(0, 3).map((n) => (
              <a key={n.to} href={n.to} className="mb-2.5 block text-sm text-[#cfeee5] hover:text-accent transition-colors">
                {n.label}
              </a>
            ))}
          </div>
          <div>
            <p className="micro mb-4 text-[#9fb5ad]">Proof</p>
            <a href="#/certificates" className="mb-2.5 block text-sm text-[#cfeee5] hover:text-accent transition-colors">Certificates</a>
            <a href="#/protocol" className="mb-2.5 block text-sm text-[#cfeee5] hover:text-accent transition-colors">Protocol boundary</a>
            <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="mb-2.5 flex items-center gap-1 text-sm text-[#cfeee5] hover:text-accent transition-colors">
              Explorer <ArrowUpRight size={13} />
            </a>
          </div>
          <div>
            <p className="micro mb-4 text-[#9fb5ad]">Release</p>
            <p className="text-sm text-[#cfeee5]">Chain {CHAIN_ID}</p>
            <p className="mt-2 text-sm text-[#cfeee5]">{isConfigured() ? shortHash(CONTRACT_ADDRESS, 10, 8) : "Deployment pending"}</p>
            <p className="mt-2 text-sm text-[#cfeee5]">Status · {DEPLOYMENT_STATUS}</p>
            <p className="micro mt-4 flex items-center gap-2 text-[11px] text-[#9fb5ad]">
              <ShieldCheck size={13} className="text-accent" /> Accounting invariant on-chain
            </p>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#f8fcf92b] pt-6">
          <span className="micro text-[10px] text-[#9fb5ad]">Rivet · Funded repair missions · GenLayer Studionet</span>
          <span className="micro text-[10px] text-[#9fb5ad]">Semantic judgment never moves money · Deterministic settlement does</span>
        </div>
      </div>
    </footer>
  );
}
