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
    db.player.findMany({ where: { active: true }, orderBy: [{ baseRating: "desc" }, { name: "asc" }] }),
  ]);

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
          <ol className="border-[3px] border-moss bg-paper shadow-hard divide-y-2 divide-moss/20">
            {players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 font-serif text-lg text-moss-soft tabular-nums">
                  {i + 1}º
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">{p.name}</span>
                    {p.isGoalkeeper && <GloveBadge className="size-4" />}
                  </div>
                  <p className="text-[10px] uppercase font-bold text-moss-soft tracking-wider">
                    {p.ratedMatches} {p.ratedMatches === 1 ? "partida avaliada" : "partidas avaliadas"}
                  </p>
                </div>
                <div className="flex items-center gap-1 border-2 border-moss bg-paper-dark px-2.5 py-1 shadow-hard-sm">
                  <Star className="size-3.5 fill-brick text-brick" />
                  <span className="font-serif text-base font-bold text-moss tabular-nums">
                    {formatRating(p.baseRating)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
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
