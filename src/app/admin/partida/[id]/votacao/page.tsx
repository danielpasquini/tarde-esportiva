import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ArrowUpRight, CheckCircle2, RotateCcw, Vote } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatMatchDate } from "@/lib/format";
import { closeVoting, openVoting, reopenVoting } from "@/app/admin/actions";
import { CopyLink, ShareVotingLink, SubmitButton } from "@/components/client";
import { GloveBadge, Loading, StatusStamp } from "@/components/ui";
import SpotlightCard from "@/components/SpotlightCard";
import CountUp from "@/components/CountUp";
import SplitText from "@/components/SplitText";
import ShinyText from "@/components/ShinyText";

export const metadata = { title: "Ver Votação • Organizador" };

async function MatchVotingAdminView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  await requireAdmin();

  const [match, averages, attendances, distinctVoters] = await Promise.all([
    db.match.findUnique({
      where: { id },
    }),
    db.vote.groupBy({
      by: ["targetId"],
      where: { matchId: id },
      _avg: { score: true },
      _count: { score: true },
    }),
    db.attendance.findMany({
      where: { matchId: id },
      include: { player: true },
      orderBy: { player: { name: "asc" } },
    }),
    db.vote.findMany({
      where: { matchId: id },
      select: { voterId: true },
      distinct: ["voterId"],
    }),
  ]);

  if (!match) notFound();

  const voterIds = new Set(distinctVoters.map((v) => v.voterId));
  const avgMap = new Map(averages.map((a) => [a.targetId, a._avg.score ?? 0]));
  const countMap = new Map(averages.map((a) => [a.targetId, a._count.score ?? 0]));

  const sorted = attendances
    .map((att) => {
      const rawAvg = avgMap.get(att.playerId) ?? 0;
      const roundedAvg = Math.round(rawAvg * 10) / 10;
      return {
        id: att.playerId,
        name: att.player.name,
        isGoalkeeper: att.asGoalkeeper || att.player.isGoalkeeper,
        avg: roundedAvg,
        count: countMap.get(att.playerId) ?? 0,
        baseRating: att.player.baseRating,
        hasVoted: voterIds.has(att.playerId),
      };
    })
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

  const list = sorted.map((p, idx) => ({
    ...p,
    rank: p.avg > 0 ? 1 + sorted.filter((other) => other.avg > p.avg).length : idx + 1,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho da Área de Votação */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard fut-grid-bg flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              href={`/admin/partida/${match.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-moss-soft hover:text-brick transition-colors mb-1.5"
            >
              <ArrowLeft className="size-3.5" /> Voltar para Gerenciar Partida
            </Link>
            <div>
              <span className="hud-tag bg-moss text-paper border-transparent mb-1">
                <ShinyText text="ÁREA DO ADMINISTRADOR • VOTAÇÃO" color="#f6f4ef" shineColor="#d9a520" speed={2.2} />
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl text-moss leading-tight first-letter:uppercase">
                <SplitText text={formatMatchDate(match.date)} tag="span" />
              </h1>
            </div>
          </div>

          <StatusStamp status={match.status} votingOpen={match.votingOpen} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-moss/10">
          <span className="text-xs font-bold text-moss-soft">
            Votantes:{" "}
            <strong className="font-mono text-moss">
              <CountUp to={voterIds.size} duration={0.8} /> / {attendances.length}
            </strong>{" "}
            confirmados
          </span>

          <div className="flex items-center gap-2">
            {match.status !== "FINISHED" ? (
              !match.votingOpen ? (
                <form action={openVoting.bind(null, match.id)}>
                  <SubmitButton className="bg-moss text-paper hover:bg-moss-soft py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-brick border-transparent">
                    Abrir Votação
                  </SubmitButton>
                </form>
              ) : (
                <form action={closeVoting.bind(null, match.id)}>
                  <SubmitButton
                    className="bg-brick text-paper hover:bg-brick/90 py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm border-transparent"
                    confirm="Deseja encerrar a votação desta partida e atualizar a nota base dos jogadores?"
                  >
                    Encerrar Votação e Salvar Notas
                  </SubmitButton>
                </form>
              )
            ) : (
              <form action={reopenVoting.bind(null, match.id)}>
                <SubmitButton
                  className="bg-paper-dark text-moss hover:bg-paper py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-hard-sm"
                  confirm="Deseja reabrir a votação desta partida? As notas aplicadas ao encerrar serão revertidas até o novo encerramento."
                >
                  <RotateCcw className="size-3.5" />
                  Reabrir Votação
                </SubmitButton>
              </form>
            )}
          </div>
        </div>

        {match.votingOpen && (
          <ShareVotingLink
            url={`/votar/${match.voteToken}`}
            matchDate={formatMatchDate(match.date)}
          />
        )}
      </SpotlightCard>

      {/* Tabela Completa de Votação e Notas */}
      <SpotlightCard className="border border-moss/15 bg-paper p-4 sm:p-5 rounded-2xl shadow-hard flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-moss/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Vote className="size-5 text-brick" />
            <h2 className="font-serif text-2xl text-moss">Tabela de Votação e Notas</h2>
          </div>
          <span className="hud-tag bg-paper-dark text-moss font-mono">
            <span>{list.length} jogadores</span>
          </span>
        </div>

        {match.status === "FINISHED" && (
          <div className="p-3 bg-moss/8 rounded-xl border border-moss/15 text-xs text-moss font-semibold flex items-center gap-2">
            <CheckCircle2 className="size-4 text-moss shrink-0" />
            Partida finalizada. As notas computadas abaixo já foram incorporadas à nota base dos jogadores.
          </div>
        )}

        {list.length ? (
          <div className="border border-moss/15 rounded-xl overflow-hidden bg-white/75">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-moss text-paper uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-2 w-8 text-center font-extrabold">#</th>
                    <th className="py-2.5 px-2 font-extrabold">Jogador</th>
                    <th className="py-2.5 px-2 text-center font-extrabold">Votos</th>
                    <th className="py-2.5 px-2 text-right font-extrabold">Média</th>
                    <th className="py-2.5 px-2 text-right font-extrabold">Base</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-moss/10 text-xs">
                  {list.map((p) => (
                    <tr
                      key={p.id}
                      className={
                        p.rank <= 5 && p.avg > 0 ? "bg-amber-500/8 font-semibold" : "hover:bg-paper-dark/40"
                      }
                    >
                      <td className="py-2.5 px-2 tabular-nums text-moss-soft text-center font-mono">
                        {p.avg > 0 ? `${p.rank}º` : "–"}
                      </td>
                      <td className="py-2.5 px-2 min-w-0 max-w-[160px]">
                        <div className="flex items-center gap-1 min-w-0">
                          {p.avg > 0 && p.rank === 1 && <span className="text-xs leading-none shrink-0">🥇</span>}
                          {p.avg > 0 && p.rank === 2 && <span className="text-xs leading-none shrink-0">🥈</span>}
                          {p.avg > 0 && p.rank === 3 && <span className="text-xs leading-none shrink-0">🥉</span>}
                          <Link
                            href={`/perfil/${p.id}`}
                            className="truncate font-bold text-moss hover:text-brick hover:underline"
                          >
                            {p.name}
                          </Link>
                          {p.isGoalkeeper && <GloveBadge />}
                          {p.rank === 1 && p.avg > 0 && (
                            <span className="text-[9px] rounded-xs bg-moss text-paper font-extrabold px-1.5 py-0.5 shrink-0">
                              CRAQUE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums font-mono">{p.count}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-extrabold text-moss whitespace-nowrap">
                        {p.avg > 0 ? (
                          <span className="inline-flex items-center rounded-sm border border-moss/20 bg-paper-dark/75 px-1.5 py-0.5">
                            ★ {p.avg.toFixed(1).replace(".", ",")}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-moss-soft whitespace-nowrap">
                        {p.baseRating != null ? `★ ${p.baseRating.toFixed(1).replace(".", ",")}` : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-moss-soft">Nenhum jogador confirmado para esta partida.</p>
        )}
      </SpotlightCard>
    </div>
  );
}

export default function MatchVotingAdminPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading label="Carregando votação…" />}>
      <MatchVotingAdminView params={params} />
    </Suspense>
  );
}
