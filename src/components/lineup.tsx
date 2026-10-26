import { byTeams, preDraw, type AttendanceFull, type MatchFull } from "@/lib/match";
import { TEAM_META, teamsFor, type TeamKey } from "@/lib/teams";
import { formatRating } from "@/lib/rating";
import { removeAttendance, setTeam, toggleGoalkeeper } from "@/app/admin/actions";
import { SubmitButton } from "@/components/client";
import { Empty, GloveBadge } from "@/components/ui";

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
              {a.isGoalkeeper && <GloveBadge />}
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
        meta={`${goalkeepers.length}/${Math.max(match.numTeams, 2)}`}
        items={goalkeepers}
        match={match}
        admin={admin}
        empty="Nenhum goleiro fixo confirmado"
      />
      <PreDrawBlock
        title="Titulares"
        meta={`${line.length}/${capacity}`}
        items={line}
        match={match}
        admin={admin}
        empty="Nenhum titular confirmado"
      />
      <PreDrawBlock
        title="Lista de Espera"
        meta={`${waitlist.length} na espera`}
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
    <form action={setTeam.bind(null, match.id, att.id)} className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold text-moss-soft uppercase mr-0.5">Mudar para:</span>
      {targets.map((t) => (
        <SubmitButton
          key={t}
          name="team"
          value={t}
          className={`h-7 px-2.5 rounded text-[11px] font-bold uppercase tracking-wide border shadow-xs ${TEAM_META[t].swatch} ${TEAM_META[t].border} hover:opacity-90 active:scale-95`}
          pendingLabel="…"
          title={`Transferir para ${TEAM_META[t].label}`}
        >
          {TEAM_META[t].label}
        </SubmitButton>
      ))}
    </form>
  );
}

export function TeamsBoard({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  const { teams, fixedGkMode, fieldGkA, fieldGkB, singleFixedGk } = byTeams(match);
  const editable = admin && match.status !== "FINISHED";

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Informativo da Regra de Goleiros Fixos */}
      {fixedGkMode === "TWO_FIXED" && (
        <section className="border-[3px] border-moss bg-amber-500/10 p-4 shadow-hard flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧤</span>
            <h4 className="font-serif text-base font-bold text-moss">Regra dos 2 Goleiros Fixos de Campo Ativa</h4>
          </div>
          <p className="text-xs text-moss">
            Temos 2 goleiros fixos na partida. Eles não pertencem a um time exclusivo: cada um defende uma trave e joga para a equipe que estiver daquele lado do campo em cada jogo.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <span className="border-2 border-moss bg-paper px-3 py-1 shadow-xs text-moss">
              🥅 Gol Lado A: <span className="text-brick">{fieldGkA?.player.name}</span>
            </span>
            <span className="border-2 border-moss bg-paper px-3 py-1 shadow-xs text-moss">
              🥅 Gol Lado B: <span className="text-brick">{fieldGkB?.player.name}</span>
            </span>
          </div>
        </section>
      )}

      {fixedGkMode === "ONE_FIXED" && (
        <section className="border-[3px] border-moss bg-paper-dark p-3.5 shadow-hard-sm text-xs flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧤</span>
            <span className="font-bold text-moss">
              1 Goleiro Fixo Confirmado: {singleFixedGk?.player.name} (Time {TEAM_META[singleFixedGk?.team as TeamKey]?.label ?? singleFixedGk?.team})
            </span>
          </div>
          <p className="text-moss-soft pl-6 text-[11px]">
            Nas partidas dos outros times, chama-se um jogador parado/em descanso de outra equipe para atuar no gol a cada rodada.
          </p>
        </section>
      )}

      {teams.map(({ team, players, keeper, activeLine, unavailablePlayers, borrowedIn, strength, lineCount, restingTeamForGk }) => {
        const meta = TEAM_META[team as TeamKey];
        const average = lineCount > 0 ? strength / lineCount : 0;

        return (
          <section
            key={team}
            className="border-[3px] border-moss bg-paper shadow-hard"
            aria-label={`Time ${meta.label}`}
          >
            {/* Header estilo TeamCard */}
            <header className={`flex items-center justify-between gap-3 border-b-[3px] border-moss px-4 py-3.5 ${meta.swatch} ${meta.text}`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-80">Colete</p>
                <h3 className="font-serif text-3xl leading-none">Time {meta.label}</h3>
              </div>
              <div className="border-2 border-moss bg-paper px-3 py-1 text-center text-moss shadow-hard-sm">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-moss-soft">Força do Time</p>
                <p className="font-serif text-2xl leading-none tabular-nums font-bold">
                  {admin ? average.toFixed(1).replace(".", ",") : strength.toFixed(1).replace(".", ",")}
                </p>
              </div>
            </header>

            <div className="flex items-center justify-between border-b-2 border-dashed border-moss/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-moss-soft">
              <span>{players.length} atletas ({lineCount}/{match.lineSize} linha em campo)</span>
              <span>
                Força total: <strong className="font-serif text-sm text-moss">{strength.toFixed(1)}</strong>
              </span>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Seção do Goleiro */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-moss">
                  <GloveBadge />
                  <span>Goleiro</span>
                </h4>

                {fixedGkMode === "TWO_FIXED" ? (
                  <div className="border-2 border-moss bg-paper-dark p-3 rounded flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <GloveBadge />
                      <span className="font-bold text-sm text-moss">Goleiro Fixo de Campo</span>
                    </div>
                    <p className="text-xs text-moss-soft">
                      Gol Lado A: <strong>{fieldGkA?.player.name}</strong> • Gol Lado B: <strong>{fieldGkB?.player.name}</strong> (defendem quem estiver do lado deles)
                    </p>
                  </div>
                ) : keeper ? (
                  <div className="border-2 border-moss bg-paper p-3 rounded flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GloveBadge />
                        <span className="font-bold text-sm text-moss">{keeper.player.name}</span>
                        <span className="text-[9px] bg-moss text-paper px-1.5 py-0.5 rounded font-bold uppercase">Fixo</span>
                      </div>
                      {admin && (
                        <span className="text-xs font-mono text-moss-soft">
                          ★ {formatRating(keeper.ratingAtDraw ?? keeper.player.baseRating)}
                        </span>
                      )}
                    </div>
                    {editable && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-moss/10 flex-wrap">
                        <MoveButtons match={match} att={keeper} exclude={keeper.team} />
                        <form action={toggleGoalkeeper.bind(null, match.id, keeper.id)}>
                          <SubmitButton className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-paper-dark border border-moss/30 rounded">
                            Tornar Jogador de Linha
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-amber-600 bg-amber-500/10 p-3 rounded flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔄</span>
                      <div>
                        <span className="font-bold text-xs text-amber-950 uppercase">Goleiro Emprestado da Rodada</span>
                        <p className="text-[11px] text-amber-900">
                          Revezamento com jogador parado do Time {restingTeamForGk ? TEAM_META[restingTeamForGk as TeamKey]?.label : "em descanso"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 border border-amber-400 text-amber-950 px-2 py-0.5 rounded">
                      Goleiro Rotativo
                    </span>
                  </div>
                )}
              </div>

              {/* Jogadores de Linha Titulares */}
              <div>
                <h4 className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-moss">
                  <span>Jogadores de Linha ({activeLine.length})</span>
                </h4>
                {activeLine.length ? (
                  <ol className="border-2 border-moss divide-y divide-moss/20 rounded overflow-hidden">
                    {activeLine.map((att, i) => (
                      <li key={att.id} className="flex flex-col gap-1.5 p-2.5 bg-paper hover:bg-paper-dark/30 transition-colors">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 font-serif text-moss-soft text-base tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1 font-semibold text-sm truncate">{att.player.name}</span>
                          {att.borrowedToTeam && (
                            <span className="text-[9px] font-bold text-amber-950 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded uppercase">
                              🔄 Empresta para {TEAM_META[att.borrowedToTeam as TeamKey]?.label ?? att.borrowedToTeam}
                            </span>
                          )}
                          {admin && (
                            <span className="text-xs font-mono text-moss-soft">
                              ★ {formatRating(att.ratingAtDraw ?? att.player.baseRating)}
                            </span>
                          )}
                        </div>
                        {editable && (
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-dashed border-moss/15 pl-7">
                            <MoveButtons match={match} att={att} exclude={att.team} />
                            <form action={toggleGoalkeeper.bind(null, match.id, att.id)}>
                              <SubmitButton className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 rounded hover:bg-amber-100">
                                Definir como Goleiro
                              </SubmitButton>
                            </form>
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="border border-dashed border-moss/40 px-3 py-2 text-xs text-moss-soft rounded">
                    Nenhum jogador de linha titular alocado.
                  </p>
                )}
              </div>

              {/* Jogadores Emprestados (FRISADOS NO MELHOR LUGAR) */}
              {borrowedIn.length > 0 && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-900">
                    <span>🔄 Jogadores Emprestados ({borrowedIn.length})</span>
                  </h4>
                  <ul className="border-2 border-dashed border-amber-500 bg-amber-500/10 divide-y divide-amber-400/40 rounded overflow-hidden">
                    {borrowedIn.map((att) => (
                      <li key={`borrowed-${att.id}`} className="flex items-center justify-between p-2.5 bg-amber-500/15">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-amber-950 text-sm">🔄 {att.player.name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded shadow-xs">
                            Emprestado do Time {TEAM_META[att.team as TeamKey]?.label ?? att.team}
                          </span>
                        </div>
                        {admin && (
                          <span className="text-xs font-mono text-moss-soft font-semibold">
                            ★ {formatRating(att.ratingAtDraw ?? att.player.baseRating)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Jogadores Indisponíveis (Lesão/Atraso) */}
              {unavailablePlayers.length > 0 && (
                <div>
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
                    <span>⚠️ Desfalques / Indisponíveis ({unavailablePlayers.length})</span>
                  </h4>
                  <ul className="border border-brick/40 bg-brick/5 divide-y divide-brick/20 rounded">
                    {unavailablePlayers.map((att) => (
                      <li key={`unavail-${att.id}`} className="flex items-center justify-between p-2 text-xs text-brick">
                        <span className="line-through font-semibold">⚠️ {att.player.name}</span>
                        <span className="text-[9px] uppercase font-bold bg-paper border border-brick px-1.5 py-0.5">
                          {att.unavailableReason || "Indisponível"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
