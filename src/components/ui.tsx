import { Hand } from "lucide-react";
import { TEAM_META, isTeam } from "@/lib/teams";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Lista aberta", cls: "stamp-open" },
  DRAWN: { label: "Times sorteados", cls: "stamp-drawn" },
  FINISHED: { label: "Encerrada", cls: "stamp-done" },
};

export function GloveBadge({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 bg-amber-500/15 text-amber-900 border border-amber-600/40 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shrink-0 shadow-xs",
        className,
      )}
      title="Goleiro"
    >
      <Hand className="size-3.5 fill-amber-500/40 text-amber-700" strokeWidth={2.5} aria-hidden="true" />
      <span>GL</span>
    </span>
  );
}

export function TeamDot({ team, className }: { team: string; className?: string }) {
  const meta = isTeam(team) ? TEAM_META[team] : null;
  return (
    <span
      className={cn("size-3.5 border-2 border-moss inline-block shrink-0", meta?.swatch, className)}
      aria-hidden
    />
  );
}

export function TeamName({ team }: { team: string }) {
  const meta = isTeam(team) ? TEAM_META[team] : null;
  return (
    <span className="inline-flex items-center gap-2">
      <TeamDot team={team} />
      <span className="font-semibold">{meta?.label ?? team}</span>
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
