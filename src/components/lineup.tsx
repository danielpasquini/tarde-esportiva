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
    <details className="relative inline-block text-left">
      <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-wider text-moss-soft hover:text-moss border border-moss/30 bg-paper px-2 py-1 rounded inline-flex items-center gap-1 select-none">
        <span>Mudar time</span>
        <span className="text-[8px]">▼</span>
      </summary>
      <div className="absolute right-0 z-30 mt-1 flex flex-col gap-1 p-1.5 bg-paper border-2 border-moss shadow-hard min-w-32 rounded">
        <form action={setTeam.bind(null, match.id, att.id)} className="flex flex-col gap-1">
          {targets.map((t) => (
            <SubmitButton
              key={t}
              name="team"
              value={t}
              className={`w-full text-left px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wide border shadow-xs ${TEAM_META[t].swatch} ${TEAM_META[t].border} hover:opacity-90 active:scale-95`}
              pendingLabel="…"
              title={`Transferir para ${TEAM_META[t].label}`}
            >
              Time {TEAM_META[t].label}
            </SubmitButton>
          ))}
        </form>
      </div>
    </details>
  );
}

export function TeamsBoard({ match, admin = false }: { match: MatchFull; admin?: boolean }) {
  const { teams } = byTeams(match);
  const editable = admin && match.status !== "FINISHED";

  return (
    <div className="flex flex-col gap-6">
      {teams.map(({ team, players, keeper, activeLine, unavailablePlayers, borrowedIn, strength, lineCount }) => {
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
              {admin && (
                <div className="border-2 border-moss bg-paper px-3 py-1 text-center text-moss shadow-hard-sm">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-moss-soft">Força do Time</p>
                  <p className="font-serif text-2xl leading-none tabular-nums font-bold">
                    {average.toFixed(1).replace(".", ",")}
                  </p>
                </div>
              )}
            </header>

            <div className="flex items-center justify-between border-b-2 border-dashed border-moss/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-moss-soft">
              <span>{players.length} jogadores ({lineCount}/{match.lineSize} jogadores em campo)</span>
              {admin && (
                <span>
                  Força total: <strong className="font-serif text-sm text-moss">{strength.toFixed(1)}</strong>
                </span>
              )}
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Roster de Jogadores: Goleiro (se tiver fixo) e depois decrescente por estrelas */}
              <div>
                <h4 className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-moss">
                  <span>Jogadores ({keeper ? activeLine.length + 1 : activeLine.length})</span>
                  {!keeper && (
                    <span className="text-[10px] font-semibold text-moss-soft lowercase tracking-normal">
                      (goleiro rotativo)
                    </span>
                  )}
                </h4>

                <ol className="border-2 border-moss divide-y divide-moss/20 rounded overflow-hidden">
                  {/* Goleiro Fixo (se tiver fixo) */}
                  {keeper && (
                    <li className="flex items-center justify-between gap-2 p-2.5 bg-paper-dark/50">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className="w-5 font-serif text-moss-soft text-base tabular-nums flex items-center justify-center">
                          <GloveBadge />
                        </span>
                        <span
                          className={`size-3 rounded-xs border border-moss/40 shrink-0 ${TEAM_META[keeper.team as TeamKey]?.swatch ?? ""}`}
                          title={`Time ${TEAM_META[keeper.team as TeamKey]?.label}`}
                        />
                        <span className="font-semibold text-sm truncate">{keeper.player.name}</span>
                        <span className="text-[9px] bg-moss text-paper px-1.5 py-0.5 rounded font-bold uppercase">
                          Goleiro Fixo
                        </span>
                        {admin && (
                          <span className="text-xs font-mono text-moss-soft">
                            ★ {formatRating(keeper.ratingAtDraw ?? keeper.player.baseRating)}
                          </span>
                        )}
                      </div>
                      {editable && (
                        <div className="flex items-center">
                          <MoveButtons match={match} att={keeper} exclude={keeper.team} />
                        </div>
                      )}
                    </li>
                  )}

                  {/* Jogadores em ordem decrescente de nota/estrelas */}
                  {activeLine.map((att, i) => (
                    <li key={att.id} className="flex items-center justify-between gap-2 p-2.5 bg-paper hover:bg-paper-dark/30 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className="w-5 font-serif text-moss-soft text-base tabular-nums">
                          {String(i + (keeper ? 2 : 1)).padStart(2, "0")}
                        </span>
                        <span
                          className={`size-3 rounded-xs border border-moss/40 shrink-0 ${TEAM_META[att.team as TeamKey]?.swatch ?? ""}`}
                          title={`Time ${TEAM_META[att.team as TeamKey]?.label}`}
                        />
                        <span className="font-semibold text-sm truncate">{att.player.name}</span>
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
                        <div className="flex items-center">
                          <MoveButtons match={match} att={att} exclude={att.team} />
                        </div>
                      )}
                    </li>
                  ))}

                  {!keeper && activeLine.length === 0 && (
                    <li className="p-3 text-xs text-moss-soft italic">
                      Nenhum jogador alocado neste time.
                    </li>
                  )}
                </ol>
              </div>

              {/* Jogadores Emprestados de Outros Times para este time */}
              {borrowedIn.length > 0 && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-900">
                    <span>🔄 Jogadores Emprestados ({borrowedIn.length})</span>
                  </h4>
                  <ul className="border-2 border-dashed border-amber-500 bg-amber-500/10 divide-y divide-amber-400/40 rounded overflow-hidden">
                    {borrowedIn.map((att) => (
                      <li key={`borrowed-${att.id}`} className="flex items-center justify-between p-2.5 bg-amber-500/15">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs">🔄</span>
                          <span
                            className={`size-3 rounded-xs border border-moss/40 shrink-0 ${TEAM_META[att.team as TeamKey]?.swatch ?? ""}`}
                            title={`Time original: ${TEAM_META[att.team as TeamKey]?.label}`}
                          />
                          <span className="font-bold text-amber-950 text-sm">{att.player.name}</span>
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

              {/* Jogadores Indisponíveis deste time */}
              {unavailablePlayers.length > 0 && (
                <div>
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-brick">
                    <span>⚠️ Desfalques / Indisponíveis ({unavailablePlayers.length})</span>
                  </h4>
                  <ul className="border border-brick/40 bg-brick/5 divide-y divide-brick/20 rounded">
                    {unavailablePlayers.map((att) => (
                      <li key={`unavail-${att.id}`} className="flex items-center justify-between p-2 text-xs text-brick">
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-2.5 rounded-xs border border-brick/40 shrink-0 ${TEAM_META[att.team as TeamKey]?.swatch ?? ""}`}
                          />
                          <span className="line-through font-semibold">{att.player.name}</span>
                        </div>
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
