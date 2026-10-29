import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, Radio, Trophy, User, Vote } from "lucide-react";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { formatMatchDate } from "@/lib/format";
import { GloveBadge, Loading, StatusStamp, TeamColorBadge } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import GlareHover from "@/components/GlareHover";
import TiltedCard from "@/components/TiltedCard";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

async function MatchView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [match, averages, isOrganizer] = await Promise.all([
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
    isAdmin(),
  ]);
  if (!match) notFound();
  if (match.status !== "FINISHED") {
    redirect("/");
  }

  const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score ?? 0]));
  const countMap = new Map(averages.map((a) => [a.targetId, a._count.score ?? 0]));

  const sortedRated = match.attendances
    .map((att) => {
      const rawAvg = avgMap.get(att.playerId) ?? 0;
      const avg = Math.round(rawAvg * 10) / 10;
      return {
        id: att.playerId,
        name: att.player.name,
        team: att.team,
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
  const winners = top5.filter((p) => p.rank === 1);
  const runnersUp = top5.filter((p) => p.rank > 1);

  return (
    <div className="flex flex-col gap-5">
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard fut-grid-bg">
        <Link
          href="/historico"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-moss-soft hover:text-brick transition-colors mb-2.5"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao Histórico
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="hud-tag bg-moss text-paper border-transparent mb-2">
              <span>RESUMO • PARTIDA</span>
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-moss first-letter:uppercase leading-tight">
              <SplitText text={formatMatchDate(match.date)} tag="span" />
            </h1>
            {(match.location || match.cost != null) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-moss font-bold">
                {match.location && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-moss/15 bg-white/80 px-2.5 py-0.5">
                    📍 {match.location}
                  </span>
                )}
                {match.cost != null && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-brick/25 bg-brick/10 px-2.5 py-0.5 font-mono">
                    💰 R$ {match.cost.toFixed(2).replace(".", ",")} por jogador
                  </span>
                )}
              </div>
            )}
          </div>
          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>
        <div className="mt-3.5 pt-3 border-t border-moss/10 flex items-center justify-between text-xs text-moss font-bold flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-wider text-[10px] text-moss-soft">Atletas Relacionados</span>
            <span className="font-mono text-sm">
              <CountUp to={match.attendances.length} duration={1} /> jogadores confirmados
            </span>
          </div>
          {isOrganizer && (
            <Link
              href={`/admin/partida/${match.id}/votacao`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-moss text-paper hover:bg-moss-soft px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-colors"
            >
              <Vote className="size-3.5 text-team-amarelo" />
              Ver Votação
            </Link>
          )}
        </div>
      </SpotlightCard>

      {match.votingOpen && (
        <GlareHover
          glareColor="#d9a520"
          glareOpacity={0.22}
          className="border border-brick/35 bg-gradient-to-r from-amber-500/12 via-paper-dark to-paper rounded-2xl shadow-hard-brick transition-all active:scale-[0.99]"
        >
          <Link
            href={`/votar/${match.voteToken}`}
            className="flex items-center justify-between px-4 py-3.5 text-moss group"
            id="ir-votacao"
          >
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brick">
                <Radio className="size-3 animate-pulse text-brick" />
                <ShinyText text="Votação Aberta" color="#b47a16" shineColor="#16281e" speed={1.8} />
              </span>
              <span className="block font-serif text-lg leading-tight group-hover:text-brick transition-colors">
                Votação Pós-Jogo
              </span>
            </div>
            <span className="inline-flex items-center justify-center size-9 rounded-lg bg-moss text-paper group-hover:bg-brick transition-colors shrink-0">
              <ArrowRight className="size-4" />
            </span>
          </Link>
        </GlareHover>
      )}

      {/* Destaques da Rodada / Top 5 */}
      {showTop5 && winners.length > 0 && (
        <SpotlightCard
          spotlightColor="rgba(217, 165, 32, 0.2)"
          className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-moss/10 pb-3">
            <div>
              <span className="hud-tag bg-brick text-paper border-transparent mb-1">
                <ShinyText text="DESTAQUES" color="#f6f4ef" shineColor="#ffffff" speed={2.2} />
              </span>
              <h2 className="font-serif text-2xl text-moss">
                <SplitText text="Top 5 da Rodada" tag="span" />
              </h2>
            </div>
            <div className="size-9 rounded-lg border border-brick/25 bg-amber-500/10 flex items-center justify-center">
              <Trophy className="size-4 text-brick" />
            </div>
          </div>

          {/* 1º Colocado(s) em Destaque */}
          <div className="flex flex-col gap-3">
            {winners.map((winner) => (
              <TiltedCard
                key={winner.id}
                rotateAmplitude={3}
                scaleOnHover={1.01}
                className="rounded-xl shadow-hard-gold"
              >
                <GlareHover
                  glareColor="#d9a520"
                  glareOpacity={0.22}
                  className="border border-amber-500/40 bg-gradient-to-br from-amber-400/20 via-amber-200/10 to-white/80 p-3.5 rounded-xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="size-11 rounded-lg bg-amber-500/20 border border-amber-600/30 flex items-center justify-center text-2xl leading-none shrink-0"
                        aria-label="Medalha de Ouro"
                      >
                        🥇
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center rounded-sm bg-moss text-paper px-2 py-0.5 text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-[0.12em] whitespace-nowrap mb-1">
                          <ShinyText
                            text={winners.length > 1 ? "Craque • 1º (Empate)" : "Craque da Rodada • 1º"}
                            color="#d9a520"
                            shineColor="#f6f4ef"
                            speed={2}
                          />
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <Link
                            href={`/perfil/${winner.id}`}
                            className="font-serif text-xl sm:text-2xl text-moss hover:text-brick hover:underline truncate"
                          >
                            {winner.name}
                          </Link>
                          {winner.isGoalkeeper && <GloveBadge />}
                        </div>
                      </div>
                    </div>

                    {/* Rating Box (Retangular) */}
                    <div className="text-right shrink-0 rounded-lg border border-amber-500/35 bg-moss text-paper px-3.5 py-2 shadow-sm">
                      <span className="block text-[8px] font-extrabold uppercase tracking-[0.16em] text-team-amarelo leading-none mb-1">
                        NOTA
                      </span>
                      <span className="font-mono text-xl font-extrabold text-paper tabular-nums leading-none whitespace-nowrap">
                        ★ <CountUp to={winner.avg} decimals={1} duration={1.4} />
                      </span>
                    </div>
                  </div>
                </GlareHover>
              </TiltedCard>
            ))}
          </div>

          {/* Tabela com os demais jogadores do Top 5 */}
          {runnersUp.length > 0 && (
            <div className="border border-moss/15 rounded-xl overflow-hidden bg-white/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-moss text-paper uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-12 font-extrabold">#</th>
                    <th className="py-2.5 px-3 font-extrabold">Jogador</th>
                    <th className="py-2.5 px-3 text-right font-extrabold">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-moss/10">
                  {runnersUp.map((p) => {
                    const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : null;
                    return (
                      <tr key={p.id} className="hover:bg-paper-dark/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-moss tabular-nums whitespace-nowrap">
                          <span className="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-sm border border-moss/15 bg-paper-dark/80 text-[10px]">
                            {p.rank}º
                          </span>
                        </td>
                        <td className="py-2.5 px-3 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {medal && <span className="text-sm leading-none shrink-0">{medal}</span>}
                            <TeamColorBadge team={p.team} />
                            <Link
                              href={`/perfil/${p.id}`}
                              className="font-bold text-moss hover:text-brick hover:underline truncate"
                            >
                              {p.name}
                            </Link>
                            {p.isGoalkeeper && <GloveBadge />}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-moss tabular-nums whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-sm border border-moss/15 bg-paper-dark/75 px-2 py-0.5">
                            <span className="text-brick">★</span>
                            <CountUp to={p.avg} decimals={1} duration={1.2} />
                          </span>
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
        </SpotlightCard>
      )}

      {/* Lista de Jogadores da Partida */}
      <SpotlightCard className="border border-moss/15 bg-paper p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-moss/10 pb-2.5">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brick block">
              Escalação Oficial
            </span>
            <h2 className="font-serif text-2xl text-moss">Jogadores da Partida</h2>
          </div>
          <span className="hud-tag bg-paper-dark text-moss font-mono">
            <span>
              <CountUp to={match.attendances.length} duration={1} /> presentes
            </span>
          </span>
        </div>

        {match.attendances.length ? (
          <ul className="flex flex-col gap-2">
            {match.attendances.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-moss/12 hover:border-moss/30 bg-white/70 hover:bg-white text-xs shadow-2xs transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-md bg-moss/10 text-moss font-mono text-[10px] font-extrabold shrink-0">
                    {i + 1}
                  </span>
                  <TeamColorBadge team={a.team} />
                  <span className="truncate font-bold text-sm text-moss group-hover:text-brick transition-colors">
                    {a.player.name}
                  </span>
                  {a.player.isGoalkeeper && <GloveBadge className="ml-0.5" />}
                </div>

                <Link
                  href={`/perfil/${a.playerId}`}
                  className="inline-flex items-center gap-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-moss-soft hover:text-paper hover:bg-moss border border-moss/15 bg-paper/80 px-2.5 py-1 shrink-0 transition-colors"
                >
                  <User className="size-3" /> Perfil
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-moss-soft italic">Nenhum jogador registrado nesta partida.</p>
        )}
      </SpotlightCard>
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
