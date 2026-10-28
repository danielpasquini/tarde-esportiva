import { Hand } from "lucide-react";
import type { MedalCounts } from "@/lib/rating";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aberta", cls: "stamp-open" },
  FINISHED: { label: "Encerrada", cls: "stamp-done" },
};

export function GloveBadge({ className }: { className?: string; showLabel?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 bg-amber-500/15 text-amber-900 border border-amber-600/40 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shrink-0 leading-none select-none align-middle",
        className,
      )}
      title="Goleiro"
    >
      <Hand className="size-3 text-amber-700 shrink-0 fill-amber-500/30" strokeWidth={2.2} aria-hidden="true" />
      <span className="translate-y-[0.5px]">GL</span>
    </span>
  );
}

export function PlayerMedals({
  medals,
  className,
}: {
  medals?: MedalCounts;
  className?: string;
}) {
  if (!medals || (medals.gold === 0 && medals.silver === 0 && medals.bronze === 0)) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-bold tabular-nums shrink-0 select-none leading-none",
        className,
      )}
      title={`Medalhas: ${medals.gold} ouro, ${medals.silver} prata, ${medals.bronze} bronze`}
    >
      {medals.gold > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-amber-400/20 text-amber-950 border border-amber-500/40 px-1 py-0.5 rounded">
          <span>🥇</span>
          <span>{medals.gold}</span>
        </span>
      )}
      {medals.silver > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-slate-200/80 text-slate-800 border border-slate-400/50 px-1 py-0.5 rounded">
          <span>🥈</span>
          <span>{medals.silver}</span>
        </span>
      )}
      {medals.bronze > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-amber-700/15 text-amber-900 border border-amber-700/35 px-1 py-0.5 rounded">
          <span>🥉</span>
          <span>{medals.bronze}</span>
        </span>
      )}
    </span>
  );
}

export function StatusStamp({ status, votingOpen }: { status: string; votingOpen?: boolean }) {
  if (votingOpen) return <span className="stamp stamp-drawn">Votação aberta</span>;
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.OPEN;
  return <span className={`stamp ${s.cls}`}>{s.label}</span>;
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="border-[3px] border-moss bg-paper p-4 text-center shadow-hard-sm" role="status">
      <p className="text-xs font-semibold uppercase tracking-widest text-moss-soft">{label}</p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-moss-soft py-4 text-center">{children}</p>;
}
