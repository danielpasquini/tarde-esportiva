import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, Trophy, User } from "lucide-react";
import { db } from "@/lib/db";
import { formatMatchDate } from "@/lib/format";
import { GloveBadge, Loading, StatusStamp } from "@/components/ui";

async function MatchView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [match, averages] = await Promise.all([
    db.match.findUnique({
      where: { id },
      include: {
        attendances: {
          include: { player: true },
          orderBy: { player: { name: "asc" } },
        },
      },
    }),
    db.vote.groupBy({
      by: ["targetId"],
      where: { matchId: id },
      _avg: { score: true },
      _count: { score: true },
    }),
  ]);
  if (!match) notFound();

  const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score ?? 0]));
  const countMap = new Map(averages.map((a) => [a.targetId, a._count.score ?? 0]));

  const sortedRated = match.attendances
    .map((att) => {
      const rawAvg = avgMap.get(att.playerId) ?? 0;
      const avg = Math.round(rawAvg * 10) / 10;
      return {
        id: att.playerId,
        name: att.player.name,
        isGoalkeeper: att.asGoalkeeper || att.player.isGoalkeeper,
        avg,
        votesCount: countMap.get(att.playerId) ?? 0,
      };
    })
    .filter((p) => p.avg > 0)
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

  const top5 = sortedRated.slice(0, 5).map((p) => ({
    ...p,
    rank: 1 + sortedRated.filter((other) => other.avg > p.avg).length,
  }));

  const showTop5 = match.status === "FINISHED" && top5.length > 0;
  const winner = top5[0] ?? null;
  const runnersUp = top5.slice(1);

  return (
    <div className="flex flex-col gap-6">
      <header className="border-[3px] border-moss bg-paper p-4 shadow-hard">
        <Link href="/" className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-moss-soft mb-2">
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss-soft">Partida</span>
            <h1 className="font-serif text-3xl first-letter:uppercase leading-tight">{formatMatchDate(match.date)}</h1>
            {(match.location || match.cost != null) && (
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-moss font-semibold">
                {match.location && <span>📍 {match.location}</span>}
                {match.cost != null && <span>💰 R$ {match.cost.toFixed(2).replace(".", ",")} por jogador</span>}
              </div>
            )}
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>
        <div className="mt-3 pt-3 border-t-2 border-moss/20 flex items-center justify-between text-xs text-moss-soft font-semibold">
          <span>{match.attendances.length} jogadores confirmados</span>
        </div>
      </header>

      {match.votingOpen && (
        <Link
          href={`/votar/${match.voteToken}`}
          className="flex items-center justify-between border-[3px] border-moss bg-paper-dark px-4 py-3.5 shadow-hard-brick text-moss transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          id="ir-votacao"
        >
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Urna aberta</span>
            <span className="block font-serif text-lg leading-tight">Votação Pós-Jogo</span>
          </div>
          <ArrowRight className="size-5 text-brick" />
        </Link>
      )}

      {/* Destaques da Rodada / Top 5 em UI de Tabela */}
      {showTop5 && winner && (
        <section className="border-[3px] border-moss bg-paper p-4 sm:p-5 shadow-hard flex flex-col gap-4">
          <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brick">Destaques</span>
              <h2 className="font-serif text-2xl">Top 5 da Rodada</h2>
            </div>
            <Trophy className="size-5 text-brick" />
          </div>

          {/* 1º Colocado em Destaque */}
          <div className="border-2 border-moss bg-amber-400/15 p-3.5 shadow-hard-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl leading-none shrink-0" aria-label="Medalha de Ouro">
                🥇
              </span>
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-brick">
                  Craque da Rodada • 1º Lugar
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Link
                    href={`/perfil/${winner.id}`}
                    className="font-serif text-xl text-moss hover:text-brick hover:underline truncate"
                  >
                    {winner.name}
                  </Link>
                  {winner.isGoalkeeper && <GloveBadge />}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 border-l-2 border-moss/20 pl-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-moss-soft">Nota</span>
              <span className="font-mono text-xl font-bold text-moss tabular-nums">
                ★ {winner.avg.toFixed(1).replace(".", ",")}
              </span>
            </div>
          </div>

          {/* Tabela com os 4 jogadores abaixo */}
          {runnersUp.length > 0 && (
            <div className="border-2 border-moss overflow-hidden">
              <table className="w-full text-left text-xs bg-paper">
                <thead className="bg-paper-dark border-b-2 border-moss uppercase tracking-wider text-[10px] text-moss-soft">
                  <tr>
                    <th className="py-2 px-3 w-12">#</th>
                    <th className="py-2 px-3">Jogador</th>
                    <th className="py-2 px-3 text-right">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-moss/20">
                  {runnersUp.map((p) => {
                    const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : null;
                    return (
                      <tr key={p.id} className="hover:bg-paper-dark/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-moss-soft tabular-nums whitespace-nowrap">
                          {p.rank}º
                        </td>
                        <td className="py-2.5 px-3 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {medal && <span className="text-sm leading-none shrink-0">{medal}</span>}
                            <Link
                              href={`/perfil/${p.id}`}
                              className="font-semibold text-moss hover:text-brick hover:underline truncate"
                            >
                              {p.name}
                            </Link>
                            {p.isGoalkeeper && <GloveBadge />}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-moss tabular-nums whitespace-nowrap">
                          ★ {p.avg.toFixed(1).replace(".", ",")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-moss-soft text-center italic">
            Apenas o Top 5 é revelado publicamente. O restante das avaliações é restrito ao organizador.
          </p>
        </section>
      )}

      {/* Lista de Jogadores da Partida */}
      <section className="border-[3px] border-moss bg-paper p-5 shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-moss/20 pb-2">
          <h2 className="font-serif text-2xl">Jogadores da Partida</h2>
          <span className="text-xs text-moss-soft font-semibold">{match.attendances.length} presentes</span>
        </div>

        {match.attendances.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {match.attendances.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center justify-between p-2.5 border border-moss/20 bg-paper-dark text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 font-mono text-[10px] text-moss-soft">{i + 1}.</span>
                  <span className="truncate font-semibold text-moss">{a.player.name}</span>
                  {a.player.isGoalkeeper && <GloveBadge />}
                </div>

                <Link
                  href={`/perfil/${a.playerId}`}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brick hover:underline shrink-0"
                >
                  <User className="size-3" /> Perfil
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-moss-soft italic">Nenhum jogador registrado nesta partida.</p>
        )}
      </section>
    </div>
  );
}

export default function MatchPage({ params }: PageProps<"/partida/[id]">) {
  return (
    <Suspense fallback={<Loading label="Carregando partida…" />}>
      <MatchView params={params} />
    </Suspense>
  );
}
