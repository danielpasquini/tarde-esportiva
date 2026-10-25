import { byTeams, preDraw, type AttendanceFull, type MatchFull } from "@/lib/match";
import { TEAM_META, teamsFor, type TeamKey } from "@/lib/teams";
import { formatRating } from "@/lib/rating";
import { removeAttendance, setTeam, toggleGoalkeeper, deleteGame } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, TeamName } from "@/components/ui";

type Listed = AttendanceFull & { rating: number; isGoalkeeper: boolean };

function ListBlock({
  title,
  meta,
  items,
  match,
  admin,
  empty,
}: {
  title: string;
  meta: string;
  items: Listed[];
  match: MatchFull;
  admin: boolean;
  empty: string;
}) {
  return (
    <section className="card rise">
      <div className="team-band">
        <span className="display text-lg">{title}</span>
        <span className="mono text-xs">{meta}</span>
      </div>
      {items.length ? (
        <ol>
          {items.map((a, i) => (
            <li key={a.id} className="roster-row">
              <span className="num">{i + 1}</span>
              <span className="flex-1 min-w-0 font-semibold truncate">{a.player.name}</span>
              {a.isGoalkeeper && <span className="tag tag-gk">GK</span>}
              {admin && <span className="mono text-xs">{formatRating(a.rating)}</span>}
              {admin && (
                <form action={removeAttendance.bind(null, match.id, a.id)}>
                  <SubmitButton className="btn btn-sm" pendingLabel="…" title={`Remover ${a.player.name}`}>
                    ✕
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <Empty>{empty}</Empty>
      )}
    </section>
  );
}

/** Lista antes do sorteio: goleiros, linha titular e fila de espera. */
export function PreDrawList({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  const { goalkeepers, line, waitlist, capacity } = preDraw(match);
  return (
    <div className="grid gap-5">
      <ListBlock
        title="Goleiros"
        meta={`${goalkeepers.length}/${match.numTeams}`}
        items={goalkeepers}
        match={match}
        admin={admin}
        empty="Nenhum goleiro fixo confirmado"
      />
      <ListBlock
        title="Titulares de linha"
        meta={`${line.length}/${capacity}`}
        items={line}
        match={match}
        admin={admin}
        empty="Ninguém confirmou ainda"
      />
      <ListBlock
        title="Lista de espera"
        meta={`${waitlist.length}`}
        items={waitlist}
        match={match}
        admin={admin}
        empty="Fila vazia"
      />
    </div>
  );
}

function MoveButtons({ match, att, exclude }: { match: MatchFull; att: AttendanceFull; exclude?: string | null }) {
  const targets = teamsFor(match.numTeams).filter((t) => t !== exclude);
  return (
    <form action={setTeam.bind(null, match.id, att.id)} className="flex flex-wrap gap-1">
      {targets.map((t) => (
        <SubmitButton
          key={t}
          name="team"
          value={t}
          className="btn btn-sm"
          pendingLabel="…"
          title={`Mover para ${TEAM_META[t].label}`}
          style={{ background: TEAM_META[t].color, color: TEAM_META[t].ink }}
        >
          {exclude ? TEAM_META[t].label.slice(0, 3) : `→ ${TEAM_META[t].label}`}
        </SubmitButton>
      ))}
      {exclude && (
        <SubmitButton name="team" value="" className="btn btn-sm" pendingLabel="…" title="Mandar para o banco">
          Banco
        </SubmitButton>
      )}
    </form>
  );
}

function PlayerRow({ match, att, index, admin }: { match: MatchFull; att: AttendanceFull; index: number; admin: boolean }) {
  const editable = admin && match.status !== "FINISHED";
  return (
    <li className="roster-row flex-wrap">
      <span className="num">{att.asGoalkeeper ? "GK" : index}</span>
      <span className="flex-1 min-w-0 font-semibold truncate">{att.player.name}</span>
      {att.asGoalkeeper && <span className="tag tag-gk">Goleiro</span>}
      {admin && <span className="mono text-xs">{formatRating(att.ratingAtDraw ?? att.player.baseRating)}</span>}
      {editable && (
        <div className="w-full flex flex-wrap items-center gap-1 pl-8">
          <MoveButtons match={match} att={att} exclude={att.team} />
          <form action={toggleGoalkeeper.bind(null, match.id, att.id)}>
            <SubmitButton className="btn btn-sm btn-gold" pendingLabel="…">
              {att.asGoalkeeper ? "Linha" : "Gol"}
            </SubmitButton>
          </form>
        </div>
      )}
    </li>
  );
}

export function TeamsBoard({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  const { teams, bench } = byTeams(match);
  const editable = admin && match.status !== "FINISHED";
  return (
    <div className="grid gap-5">
      {teams.map(({ team, players, strength, lineCount }) => {
        const meta = TEAM_META[team as TeamKey];
        const lineIds = players.filter((p) => !p.asGoalkeeper).map((p) => p.id);
        return (
          <section key={team} className="team-card rise" aria-label={`Time ${meta.label}`}>
            <div className="team-band" style={{ background: meta.color, color: meta.ink }}>
              <span className="display text-xl">{meta.label}</span>
              <span className="mono text-xs">
                {lineCount}/{match.lineSize} linha · força {formatRating(strength)}
              </span>
            </div>
            {players.length ? (
              <ul>
                {players.map((a) => (
                  <PlayerRow key={a.id} match={match} att={a} index={lineIds.indexOf(a.id) + 1} admin={admin} />
                ))}
              </ul>
            ) : (
              <Empty>Colete vazio</Empty>
            )}
          </section>
        );
      })}

      <section className="card" aria-label="Banco de reservas">
        <div className="team-band bg-paper">
          <span className="display text-xl">Banco de reservas</span>
          <span className="mono text-xs">{bench.length}</span>
        </div>
        {bench.length ? (
          <ul>
            {bench.map((a, i) => (
              <li key={a.id} className="roster-row flex-wrap">
                <span className="num">{i + 1}</span>
                <span className="flex-1 min-w-0 font-semibold truncate">{a.player.name}</span>
                {a.player.isGoalkeeper && <span className="tag tag-gk">GK</span>}
                {editable && (
                  <div className="w-full flex flex-wrap items-center gap-1 pl-8">
                    <MoveButtons match={match} att={a} />
                    <form action={removeAttendance.bind(null, match.id, a.id)}>
                      <SubmitButton className="btn btn-sm btn-brick" pendingLabel="…" confirm={`Remover ${a.player.name} da partida?`}>
                        Remover
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Ninguém no banco</Empty>
        )}
      </section>
    </div>
  );
}

export function Scoreboard({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  if (!match.games.length) return <Empty>Nenhum placar registrado ainda</Empty>;
  return (
    <ul className="card">
      {match.games.map((g) => (
        <li key={g.id} className="scoreboard">
          <span className="justify-self-start">
            <TeamName team={g.teamA} />
          </span>
          <span className="score">
            {g.scoreA}×{g.scoreB}
          </span>
          <span className="justify-self-end flex items-center gap-2">
            <TeamName team={g.teamB} />
            {admin && match.status !== "FINISHED" && (
              <form action={deleteGame.bind(null, match.id, g.id)}>
                <SubmitButton className="btn btn-sm" pendingLabel="…" title="Apagar placar" confirm="Apagar este placar?">
                  ✕
                </SubmitButton>
              </form>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
