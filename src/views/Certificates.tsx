import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BadgeCheck, Fingerprint, Medal } from "lucide-react";
import { api, Mission } from "../lib/genlayer";
import { isConfigured } from "../config/network";
import { CRITERION_RESULT, prettyTime, repoName, shortHash, shortSha } from "../lib/format";
import { AddressChip, Dot, EmptyState, Reveal, SectionHeading, SkeletonRows } from "../components/ui";

function CertificateCard({ item, index }: { item: Mission; index: number }) {
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen(!open);
    if (!open && !detail) {
      api.getCertificate(item.mission_id || item.id).then(setDetail).catch(() => setDetail({}));
    }
  };

  return (
    <Reveal delay={Math.min(index, 6) * 60}>
      <div className="plate-dark cut relative overflow-hidden">
        <div className="rail-x opacity-40" />
        <div className="p-6">
          <div className="flex items-center justify-between">
            <span className="micro flex items-center gap-2 text-accent">
              <Medal size={14} /> Repair certificate
            </span>
            <Fingerprint size={20} className="text-[#9fb5ad]" strokeWidth={1.4} />
          </div>
          <h3 className="display mt-4 text-xl font-bold leading-tight text-[#f8fcf9]">{item.title}</h3>
          <p className="micro mt-2 text-[#9fb5ad]">{repoName(item.repository_url)} · {item.mission_id || item.id}</p>
          <div className="mt-5 grid gap-1 divide-y divide-[#f8fcf917]">
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="micro text-[#9fb5ad]">Winner</span>
              <AddressChip address={item.winner} className="!border-[#f8fcf92b] !bg-transparent text-[#f8fcf9]" />
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="micro text-[#9fb5ad]">Candidate</span>
              <span className="mono-num text-sm font-semibold text-[#f8fcf9]">{shortSha(item.final_candidate_commit || item.candidate_commit)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="micro text-[#9fb5ad]">Certificate</span>
              <span className="mono-num text-sm font-semibold text-[#f8fcf9]">{shortHash(item.certificate_hash, 10, 8)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="micro text-[#9fb5ad]">Finalized</span>
              <span className="text-sm font-semibold text-[#f8fcf9]">{item.closed_at ? prettyTime(Date.parse(item.closed_at) / 1000) : "—"}</span>
            </div>
          </div>
          <button onClick={toggle} className="micro mt-5 flex items-center gap-2 text-accent hover:underline">
            <BadgeCheck size={13} /> {open ? "Hide criterion results" : "Show criterion results"}
          </button>
          {open && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f8fcf917] pt-4">
              {(detail?.criteria || []).map((row: any) => {
                const r = CRITERION_RESULT[row.result] || { label: row.result, tone: "off" as const };
                return (
                  <span key={row.id} className="chip !border-[#f8fcf92b] !bg-transparent !py-1 !px-2.5 !text-[10px] text-[#cfeee5]">
                    <Dot tone={r.tone} /> {row.id} · {r.label}
                  </span>
                );
              })}
              {detail && !detail.criteria && <span className="micro text-[#9fb5ad]">No criteria payload returned</span>}
              {!detail && <span className="micro text-[#9fb5ad]">Loading…</span>}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

export default function Certificates() {
  const configured = isConfigured();
  const [items, setItems] = useState<Mission[] | null>(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    api
      .listCertificates(0, 24)
      .then((res) => alive && setItems((res.items || []).reverse()))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [configured]);

  return (
    <section className="mx-auto max-w-[1220px] px-4 py-14 md:px-8 md:py-20">
      <Reveal>
        <SectionHeading
          kicker="Proof shelf · Finalized on-chain"
          title={<>Repair <span className="text-accent-dark">certificates</span></>}
          copy="Each plate is issued at settlement: the frozen spec, the exact winning SHA, the assessment capsule and the winner, bound into one hash anyone can recompute."
        />
      </Reveal>
      {!configured ? (
        <EmptyState
          title="Deployment pending"
          body="Certificates appear here after the release contract is configured and the first mission settles."
        />
      ) : items === null ? (
        <SkeletonRows rows={3} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          body="The first patch that survives its challenge window mints the first plate."
          action={
            <a href="#/missions" className="btn btn-sm btn-accent">
              Browse open missions <ArrowRight size={14} />
            </a>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <CertificateCard key={item.mission_id || item.id} item={item} index={i} />
            ))}
          </div>
          <Reveal delay={160}>
            <p className="micro mt-10 flex items-center justify-center gap-2 text-center text-muted">
              Certificates are public reads — no wallet needed
              <a href="#/protocol" className="flex items-center gap-1 text-accent-dark hover:underline">
                verify the model <ArrowUpRight size={12} />
              </a>
            </p>
          </Reveal>
        </>
      )}
    </section>
  );
}
