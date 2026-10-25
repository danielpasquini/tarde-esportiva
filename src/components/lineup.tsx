import { byTeams, preDraw, type AttendanceFull, type MatchFull } from "@/lib/match";
import { TEAM_META, teamsFor, type TeamKey } from "@/lib/teams";
import { formatRating } from "@/lib/rating";
import { removeAttendance, setTeam, toggleGoalkeeper, deleteGame } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, GloveBadge, TeamName } from "@/components/ui";

type Listed = AttendanceFull & { rating: number; isGoalkeeper: boolean };

function PreDrawBlock({
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
    <section className="border-[3px] border-moss bg-paper shadow-hard">
      <div className="flex items-center justify-between border-b-[3px] border-moss bg-paper-dark px-4 py-2.5">
        <h3 className="font-serif text-lg">{title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">{meta}</span>
      </div>
      {items.length ? (
        <ol className="divide-y-2 divide-moss/20">
          {items.map((a, i) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 font-serif text-lg text-moss-soft tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-semibold truncate text-sm">{a.player.name}</span>
              {a.isGoalkeeper && <GloveBadge className="size-5" />}
              {admin && (
                <span className="font-mono text-xs text-moss-soft">★ {formatRating(a.rating)}</span>
              )}
              {admin && match.status === "OPEN" && (
                <form action={removeAttendance.bind(null, match.id, a.id)}>
                  <SubmitButton
                    className="size-7 p-0 border border-moss bg-paper text-brick shadow-none text-xs"
                    pendingLabel="…"
                    title={`Remover ${a.player.name}`}
                  >
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

export function PreDrawList({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  const { goalkeepers, line, waitlist, capacity } = preDraw(match);
  return (
    <div className="flex flex-col gap-5">
      <PreDrawBlock
        title="Goleiros Fixos"
        meta={`${goalkeepers.length}/${match.numTeams}`}
        items={goalkeepers}
        match={match}
        admin={admin}
        empty="Nenhum goleiro fixo confirmado"
      />
      <PreDrawBlock
        title="Titulares de Linha"
        meta={`${line.length}/${capacity}`}
        items={line}
        match={match}
        admin={admin}
        empty="Nenhum titular confirmado"
      />
      <PreDrawBlock
        title="Lista de Espera"
        meta={`${waitlist.length} reservas`}
        items={waitlist}
        match={match}
        admin={admin}
        empty="Fila de espera vazia"
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
          className={`h-7 px-2 text-[10px] font-bold uppercase tracking-wider ${TEAM_META[t].swatch} ${TEAM_META[t].text}`}
          pendingLabel="…"
          title={`Mover para ${TEAM_META[t].label}`}
        >
          {exclude ? TEAM_META[t].label.slice(0, 3) : `→ ${TEAM_META[t].label}`}
        </SubmitButton>
      ))}
      {exclude && (
        <SubmitButton
          name="team"
          value=""
          className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-paper-dark text-moss"
          pendingLabel="…"
          title="Mandar para o banco de reservas"
        >
          Banco
        </SubmitButton>
      )}
    </form>
  );
}

export function TeamsBoard({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  const { teams, bench } = byTeams(match);
  const editable = admin && match.status !== "FINISHED";

  return (
    <div className="flex flex-col gap-6">
      {teams.map(({ team, players, strength, lineCount }) => {
        const meta = TEAM_META[team as TeamKey];
        const keeper = players.find((p) => p.asGoalkeeper);
        const linha = players.filter((p) => !p.asGoalkeeper);
        const average = lineCount > 0 ? strength / lineCount : 0;

        return (
          <section
            key={team}
            className="border-[3px] border-moss bg-paper shadow-hard"
            aria-label={`Time ${meta.label}`}
          >
            {/* Header estilo TeamCard do Pelada Raiz */}
            <header className={`flex items-center justify-between gap-3 border-b-[3px] border-moss px-4 py-3.5 ${meta.swatch} ${meta.text}`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-80">Colete</p>
                <h3 className="font-serif text-3xl leading-none">Time {meta.label}</h3>
              </div>
              <div className="border-2 border-moss bg-paper px-3 py-1 text-center text-moss shadow-hard-sm">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-moss-soft">Média</p>
                <p className="font-serif text-2xl leading-none tabular-nums font-bold">
                  {average.toFixed(1).replace(".", ",")}
                </p>
              </div>
            </header>

            <div className="flex items-center justify-between border-b-2 border-dashed border-moss/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-moss-soft">
              <span>{players.length} atletas ({lineCount}/{match.lineSize} linha)</span>
              <span>
                Força total: <strong className="font-serif text-sm text-moss">{strength.toFixed(1)}</strong>
              </span>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Goleiro Fixo */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brick">
                  <GloveBadge className="size-4" />
                  Goleiro
                </h4>
                {keeper ? (
                  <div className="border-2 border-moss bg-paper px-3 py-2 flex items-center justify-between">
                    <span className="font-semibold text-sm">{keeper.player.name}</span>
                    {admin && (
                      <span className="text-xs font-mono text-moss-soft">
                        ★ {formatRating(keeper.ratingAtDraw ?? keeper.player.baseRating)}
                      </span>
                    )}
                    {editable && (
                      <div className="flex items-center gap-1">
                        <MoveButtons match={match} att={keeper} exclude={keeper.team} />
                        <form action={toggleGoalkeeper.bind(null, match.id, keeper.id)}>
                          <SubmitButton className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-paper-dark">
                            Para Linha
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="border-2 border-dashed border-brick px-3 py-2 text-xs font-medium text-brick">
                    Sem goleiro fixo (rodízio).
                  </p>
                )}
              </div>

              {/* Jogadores de Linha */}
              <div>
                <h4 className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-moss">
                  <span>Jogadores de Linha</span>
                  <span className="text-moss-soft tabular-nums">{linha.length}</span>
                </h4>
                {linha.length ? (
                  <ol className="border-2 border-moss divide-y divide-moss/20">
                    {linha.map((att, i) => (
                      <li key={att.id} className="flex flex-col gap-1 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 font-serif text-moss-soft text-base tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1 font-semibold text-sm truncate">{att.player.name}</span>
                          {admin && (
                            <span className="text-xs font-mono text-moss-soft">
                              ★ {formatRating(att.ratingAtDraw ?? att.player.baseRating)}
                            </span>
                          )}
                        </div>
                        {editable && (
                          <div className="flex flex-wrap items-center gap-1 pl-7 pt-1">
                            <MoveButtons match={match} att={att} exclude={att.team} />
                            <form action={toggleGoalkeeper.bind(null, match.id, att.id)}>
                              <SubmitButton className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-paper-dark">
                                Virar Goleiro
                              </SubmitButton>
                            </form>
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="border-2 border-dashed border-moss/40 px-3 py-2 text-xs text-moss-soft">
                    Nenhum jogador de linha alocado.
                  </p>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* Banco de Reservas */}
      <section className="border-[3px] border-moss bg-paper shadow-hard">
        <div className="flex items-center justify-between border-b-[3px] border-moss bg-paper-dark px-4 py-2.5">
          <h3 className="font-serif text-lg">Banco de Reservas</h3>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">
            {bench.length} {bench.length === 1 ? "reserva" : "reservas"}
          </span>
        </div>
        {bench.length ? (
          <ul className="divide-y-2 divide-moss/20 p-2">
            {bench.map((a, i) => (
              <li key={a.id} className="flex flex-col gap-1 p-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 font-serif text-brick">{i + 1}.</span>
                  <span className="flex-1 font-semibold text-sm">{a.player.name}</span>
                  {a.player.isGoalkeeper && <GloveBadge className="size-4" />}
                </div>
                {editable && (
                  <div className="flex flex-wrap items-center gap-1 pl-6 pt-1">
                    <MoveButtons match={match} att={a} />
                    <form action={removeAttendance.bind(null, match.id, a.id)}>
                      <SubmitButton
                        className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-brick text-paper"
                        confirm={`Remover ${a.player.name} da partida?`}
                      >
                        Remover
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Ninguém no banco de reservas.</Empty>
        )}
      </section>
    </div>
  );
}

export function Scoreboard({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  if (!match.games.length) return <Empty>Nenhum placar registrado ainda</Empty>;
  return (
    <ul className="border-[3px] border-moss bg-paper shadow-hard divide-y-2 divide-moss/20">
      {match.games.map((g) => (
        <li key={g.id} className="grid grid-cols-3 items-center p-3 text-center">
          <div className="text-left font-semibold text-sm">
            <TeamName team={g.teamA} />
          </div>
          <div>
            <span className="font-serif text-2xl font-bold bg-moss text-paper px-2.5 py-0.5 rounded-sm">
              {g.scoreA} × {g.scoreB}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 text-right font-semibold text-sm">
            <TeamName team={g.teamB} />
            {admin && match.status !== "FINISHED" && (
              <form action={deleteGame.bind(null, match.id, g.id)}>
                <SubmitButton
                  className="size-6 p-0 border border-moss bg-paper text-brick text-xs shadow-none"
                  confirm="Apagar este placar?"
                  title="Apagar placar"
                >
                  ✕
                </SubmitButton>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
