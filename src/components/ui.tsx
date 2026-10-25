import { TEAM_META, isTeam } from "@/lib/teams";
import { STATUS_LABEL } from "@/lib/match";

export function TeamDot({ team }: { team: string }) {
  const meta = isTeam(team) ? TEAM_META[team] : null;
  return <span className="team-dot" style={{ background: meta?.color ?? "transparent" }} aria-hidden />;
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

export function Loading({ label = "Carregando a súmula…" }: { label?: string }) {
  return (
    <div className="card card-pad text-center" role="status">
      <p className="kicker">{label}</p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="kicker py-3 text-center">{children}</p>;
}
