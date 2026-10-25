import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { formatShortDate } from "@/lib/format";
import { formatRating } from "@/lib/rating";
import { TeamName, Empty, Loading } from "@/components/ui";

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
    <>
      <section>
        <div className="section-head">
          <h2 className="display text-2xl">Tabela de notas</h2>
          <span className="kicker">Média atual</span>
        </div>
        {players.length ? (
          <ol className="card">
            {players.map((p, i) => (
              <li key={p.id} className="roster-row">
                <span className="num">{i + 1}º</span>
                <span className="flex-1 font-semibold truncate">{p.name}</span>
                {p.isGoalkeeper && <span className="tag tag-gk">GK</span>}
                <span className="kicker">{p.ratedMatches} jogos</span>
                <span className="score text-base!">{formatRating(p.baseRating)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>Nenhum jogador cadastrado</Empty>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2 className="display text-2xl">Rodadas anteriores</h2>
          <span className="kicker">{matches.length}</span>
        </div>
        {matches.length ? (
          <ul className="grid gap-4">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/partida/${m.id}`} className="card card-link block" id={`historico-${m.id}`}>
                  <div className="team-band">
                    <span className="display text-lg">{formatShortDate(m.date)}</span>
                    <span className="mono text-xs">
                      {m.numTeams} times · {m._count.attendances} jogadores
                    </span>
                  </div>
                  {m.games.length ? (
                    m.games.map((g) => (
                      <div key={g.id} className="scoreboard">
                        <span className="justify-self-start">
                          <TeamName team={g.teamA} />
                        </span>
                        <span className="score text-xl!">
                          {g.scoreA}×{g.scoreB}
                        </span>
                        <span className="justify-self-end">
                          <TeamName team={g.teamB} />
                        </span>
                      </div>
                    ))
                  ) : (
                    <Empty>Sem placares registrados</Empty>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma partida encerrada ainda</Empty>
        )}
      </section>
    </>
  );
}

export default function HistoryPage() {
  return (
    <div className="space-y-8">
      <header className="text-center rise">
        <p className="kicker">Arquivo do clube</p>
        <h1 className="display text-4xl mt-1">Histórico</h1>
      </header>
      <Suspense fallback={<Loading label="Abrindo o arquivo…" />}>
        <History />
      </Suspense>
    </div>
  );
}
