import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { formatShortDate } from "@/lib/format";
import { formatRating } from "@/lib/rating";
import { TeamName, Empty, Loading, GloveBadge } from "@/components/ui";

export const metadata = { title: "Histórico" };

async function History() {
  await connection();
  const [matches, players] = await Promise.all([
    db.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { date: "desc" },
      include: { games: { orderBy: { createdAt: "asc" } }, _count: { select: { attendances: true } } },
    }),
    db.player.findMany({
      where: { active: true },
      orderBy: [{ baseRating: "desc" }, { name: "asc" }],
      include: {
        attendances: {
          where: { match: { status: "FINISHED" } },
          include: { match: true },
          orderBy: { match: { date: "desc" } },
        },
        votesGot: {
          include: { match: true },
        },
      },
    }),
  ]);

  // Agrupar média de votos recebidos por jogador e partida
  const playerMatchHistory = new Map<
    string,
    { matchId: string; date: Date; avg: number | null; team: string | null }[]
  >();

  for (const p of players) {
    const map = new Map<string, { date: Date; scores: number[]; team: string | null }>();
    for (const att of p.attendances) {
      if (att.match) {
        map.set(att.matchId, { date: att.match.date, scores: [], team: att.team });
      }
    }
    for (const v of p.votesGot) {
      if (v.match && v.match.status === "FINISHED") {
        if (!map.has(v.matchId)) {
          map.set(v.matchId, { date: v.match.date, scores: [v.score], team: null });
        } else {
          map.get(v.matchId)!.scores.push(v.score);
        }
      }
    }
    const historyList = Array.from(map.entries())
      .map(([matchId, data]) => {
        const avg = data.scores.length
          ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
          : null;
        return { matchId, date: data.date, avg, team: data.team };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    playerMatchHistory.set(p.id, historyList);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Tabela de Classificação Técnica */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b-2 border-moss pb-1">
          <h2 className="font-serif text-2xl">Média dos Jogadores</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">
            {players.length} atletas
          </span>
        </div>

        {players.length ? (
          <ul className="flex flex-col gap-3">
            {players.map((p, i) => {
              const matchesPlayed = playerMatchHistory.get(p.id) ?? [];
              return (
                <li key={p.id} className="border-[3px] border-moss bg-paper shadow-hard">
                  <details className="group">
                    <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-paper hover:bg-paper-dark transition-colors list-none">
                      <span className="w-6 font-serif text-lg text-moss-soft tabular-nums">
                        {i + 1}º
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm truncate">{p.name}</span>
                          {p.isGoalkeeper && <GloveBadge />}
                        </div>
                        <p className="text-[10px] uppercase font-bold text-moss-soft tracking-wider flex items-center gap-1.5 mt-0.5">
                          <span>
                            {matchesPlayed.length} {matchesPlayed.length === 1 ? "partida" : "partidas"}
                          </span>
                          <span className="text-moss/40">•</span>
                          <span className="text-brick group-open:hidden underline">Ver partidas</span>
                          <span className="text-brick hidden group-open:inline underline">Ocultar</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 border-2 border-moss bg-paper-dark px-2.5 py-1 shadow-hard-sm shrink-0">
                        <Star className="size-3.5 fill-brick text-brick" />
                        <span className="font-serif text-base font-bold text-moss tabular-nums">
                          {formatRating(p.baseRating)}
                        </span>
                      </div>
                    </summary>

                    <div className="border-t-2 border-moss bg-paper-dark p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-moss-soft mb-2">
                        Histórico de Notas por Partida
                      </p>
                      {matchesPlayed.length ? (
                        <div className="flex flex-col divide-y divide-moss/15 border border-moss/30 bg-paper">
                          {matchesPlayed.map((m) => (
                            <Link
                              key={m.matchId}
                              href={`/partida/${m.matchId}`}
                              className="flex items-center justify-between px-3 py-2 text-xs hover:bg-paper-dark/60 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-moss">{formatShortDate(m.date)}</span>
                                {m.team && (
                                  <span className="text-[10px] uppercase font-bold text-moss-soft">
                                    ({m.team})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 font-mono font-bold text-moss">
                                {m.avg != null ? (
                                  <>
                                    <Star className="size-3 fill-brick text-brick" />
                                    <span>{m.avg.toFixed(1).replace(".", ",")}</span>
                                  </>
                                ) : (
                                  <span className="text-moss-soft font-normal text-[11px]">Sem votos</span>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-moss-soft italic">Nenhuma partida finalizada registrada.</p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Nenhum jogador cadastrado.</Empty>
        )}
      </section>

      {/* Partidas Anteriores */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b-2 border-moss pb-1">
          <h2 className="font-serif text-2xl">Partidas Anteriores</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-moss-soft">
            {matches.length}
          </span>
        </div>

        {matches.length ? (
          <ul className="flex flex-col gap-4">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/partida/${m.id}`}
                  className="block border-[3px] border-moss bg-paper shadow-hard transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  id={`historico-${m.id}`}
                >
                  <div className="flex items-center justify-between border-b-2 border-moss bg-paper-dark px-4 py-2.5">
                    <span className="font-serif text-lg font-bold">{formatShortDate(m.date)}</span>
                    <span className="text-xs font-semibold text-moss-soft">
                      {m.numTeams} times · {m._count.attendances} atletas
                    </span>
                  </div>
                  {m.games.length ? (
                    <div className="divide-y divide-moss/20 p-2">
                      {m.games.map((g) => (
                        <div key={g.id} className="grid grid-cols-3 items-center py-1.5 px-2 text-center text-sm font-semibold">
                          <div className="text-left">
                            <TeamName team={g.teamA} />
                          </div>
                          <div>
                            <span className="font-serif text-xl font-bold bg-moss text-paper px-2 py-0.5 rounded-sm">
                              {g.scoreA} × {g.scoreB}
                            </span>
                          </div>
                          <div className="text-right">
                            <TeamName team={g.teamB} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="p-3 text-xs text-moss-soft text-center">Partida sem placares registrados.</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma partida encerrada ainda.</Empty>
        )}
      </section>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<Loading label="Carregando histórico…" />}>
      <History />
    </Suspense>
  );
}
